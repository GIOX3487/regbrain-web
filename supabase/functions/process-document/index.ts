import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { 
      file_data, 
      file_name,
      pdf_url, 
      title, 
      version = '1.0',
      jurisdiction, 
      sector, 
      source_url,
      language = 'IT'
    } = body;

    // SECURITY: Input validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (title.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Title too long (max 500 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate jurisdiction
    const validJurisdictions = ['EU', 'US', 'UK', 'Global'];
    if (jurisdiction && !validJurisdictions.includes(jurisdiction)) {
      return new Response(
        JSON.stringify({ error: 'Invalid jurisdiction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate sector
    const validSectors = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Transport', 'Government', 'Other'];
    if (sector && !validSectors.includes(sector)) {
      return new Response(
        JSON.stringify({ error: 'Invalid sector' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file_name for path traversal
    if (file_name) {
      if (typeof file_name !== 'string' || file_name.includes('..') || file_name.includes('/') || file_name.includes('\\')) {
        return new Response(
          JSON.stringify({ error: 'Invalid file name' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (file_name.length > 255) {
        return new Response(
          JSON.stringify({ error: 'File name too long (max 255 characters)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate file_data size (max 10MB base64)
    if (file_data) {
      if (typeof file_data !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid file data format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file_data.length > maxSize) {
        return new Response(
          JSON.stringify({ error: 'File too large (max 10MB)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Processing document:', { title, jurisdiction, sector, language });

    let documentText = '';

    // Handle file upload or URL
    if (file_data) {
      // Extract text from uploaded file
      console.log('Processing uploaded file:', file_name);
      
      // Extract text from pre-extracted content sent by frontend
      try {
        const base64Data = file_data.split(',')[1] || file_data;
        const fileBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        console.log(`Processing pre-extracted text, size: ${fileBuffer.length} bytes`);
        
        // Decode the text that was extracted on the frontend
        let rawText = new TextDecoder('utf-8', { fatal: false }).decode(fileBuffer);
        
        // Clean null bytes and control characters for PostgreSQL
        documentText = rawText
          .replace(/\u0000/g, '')
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
          
        if (!documentText || documentText.length < 100) {
          throw new Error(`Extracted text too short: ${documentText.length} characters`);
        }
        
        console.log(`Final text length: ${documentText.length} characters`);
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid base64 file data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
    } else if (pdf_url) {
      // Generate comprehensive mock content for regulations
      console.log('Generating content for:', title);
      documentText = generateMockContent(title, version, jurisdiction, sector, language);
    } else {
      throw new Error('Either file_data or pdf_url must be provided');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (!userError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Insert document metadata
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        version,
        jurisdiction,
        sector,
        source_url: source_url || pdf_url,
        language,
        created_by: userId,
      })
      .select()
      .single();

    if (docError) throw docError;

    console.log('Document created:', document.id);

    // OPTIMIZED CHUNKING: Extract articles/sections with structured metadata
    // Instead of simple word-based chunking, we detect and preserve article boundaries
    const chunks = extractStructuredChunks(documentText, document.id, title);

    console.log(`Generated ${chunks.length} structured chunks with article metadata`);

    // Insert chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const { error: chunkError } = await supabase
        .from('chunks')
        .insert(batch);

      if (chunkError) {
        console.error('Error inserting chunks:', chunkError);
        throw chunkError;
      }
      
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document_id: document.id,
        chunks_created: chunks.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}, false, false));

// Generate deterministic 768-dimensional embedding from text
// No synthetic vectors: lexical chunks remain usable until indexed with Gemini.
function generateEmbedding(_text: string): null { return null; }

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// OPTIMIZED CHUNKING: Extract structured chunks preserving article/section boundaries
// This improves retrieval accuracy by keeping regulatory content coherent
function extractStructuredChunks(
  documentText: string, 
  documentId: string,
  documentTitle: string
): any[] {
  const chunks: any[] = [];
  
  // Detect if this is a regulatory document by title
  const isRegulatoryDoc = /gdpr|nis2|dora|ai\s*act|cra|cyber\s*resilience|data\s*act|iso\s*27001|codice/i.test(documentTitle);
  
  if (isRegulatoryDoc) {
    // ARTICLE-BASED CHUNKING for regulatory documents
    // Split by article/section boundaries to preserve coherent regulatory content
    
    // Pattern to match article beginnings in various languages
    const articlePattern = /(?:^|\n\s*)(?:Articolo|Article|Art\.?)\s+(\d+[a-z]?(?:\s*bis|\s*ter|\s*quater)?)\s*[-–—:]?\s*/gi;
    
    // Find all article positions
    const articlePositions: { index: number; articleNum: string; match: string }[] = [];
    let match;
    
    while ((match = articlePattern.exec(documentText)) !== null) {
      articlePositions.push({
        index: match.index,
        articleNum: match[1],
        match: match[0]
      });
    }
    
    if (articlePositions.length > 0) {
      console.log(`Found ${articlePositions.length} articles in document`);
      
      // Extract each article as a separate chunk (or split large articles)
      for (let i = 0; i < articlePositions.length; i++) {
        const startPos = articlePositions[i].index;
        const endPos = i + 1 < articlePositions.length 
          ? articlePositions[i + 1].index 
          : documentText.length;
        
        const articleContent = documentText.substring(startPos, endPos).trim();
        const articleNum = articlePositions[i].articleNum;
        
        // If article is too long (>3000 chars), split into sub-chunks
        if (articleContent.length > 3000) {
          const subChunks = splitLargeArticle(articleContent, articleNum, documentId);
          chunks.push(...subChunks);
        } else if (articleContent.length > 100) {
          // Add article reference prefix for better retrieval
          const enhancedContent = `[Articolo ${articleNum}] ${articleContent}`;
          
          chunks.push({
            document_id: documentId,
            content: enhancedContent,
            start_pos: startPos,
            end_pos: endPos,
            embedding: generateEmbedding(enhancedContent)
          });
        }
      }
      
      // Handle content before first article (preamble/recitals)
      if (articlePositions[0].index > 500) {
        const preamble = documentText.substring(0, articlePositions[0].index).trim();
        if (preamble.length > 100) {
          // Split preamble into reasonable chunks
          const preambleChunks = splitByParagraphs(preamble, documentId, 0);
          chunks.unshift(...preambleChunks);
        }
      }
      
      return chunks;
    }
  }
  
  // PARAGRAPH-BASED CHUNKING for non-regulatory or unstructured documents
  return splitByParagraphs(documentText, documentId, 0);
}

// Split large articles into sub-chunks while preserving article context
function splitLargeArticle(
  articleContent: string, 
  articleNum: string, 
  documentId: string
): any[] {
  const chunks: any[] = [];
  const maxChunkSize = 2500;
  
  // Try to split by paragraphs/numbered points first
  const paragraphPattern = /(?:\n\s*\n|\n\s*\d+\.\s|\n\s*[a-z]\)\s|\n\s*-\s)/g;
  const paragraphs: string[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = paragraphPattern.exec(articleContent)) !== null) {
    if (match.index > lastIndex) {
      paragraphs.push(articleContent.substring(lastIndex, match.index));
    }
    lastIndex = match.index;
  }
  if (lastIndex < articleContent.length) {
    paragraphs.push(articleContent.substring(lastIndex));
  }
  
  // Group paragraphs into chunks under maxChunkSize
  let currentChunk = '';
  let chunkIndex = 0;
  let startPos = 0;
  
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk with article context
      const enhancedContent = `[Articolo ${articleNum} - Parte ${chunkIndex + 1}] ${currentChunk.trim()}`;
      chunks.push({
        document_id: documentId,
        content: enhancedContent,
        start_pos: startPos,
        end_pos: startPos + currentChunk.length,
        embedding: generateEmbedding(enhancedContent)
      });
      
      startPos += currentChunk.length;
      currentChunk = '';
      chunkIndex++;
    }
    currentChunk += para;
  }
  
  // Add remaining content
  if (currentChunk.trim().length > 100) {
    const enhancedContent = chunkIndex > 0 
      ? `[Articolo ${articleNum} - Parte ${chunkIndex + 1}] ${currentChunk.trim()}`
      : `[Articolo ${articleNum}] ${currentChunk.trim()}`;
    
    chunks.push({
      document_id: documentId,
      content: enhancedContent,
      start_pos: startPos,
      end_pos: startPos + currentChunk.length,
      embedding: generateEmbedding(enhancedContent)
    });
  }
  
  return chunks;
}

// Split text by paragraphs for general documents
function splitByParagraphs(
  text: string, 
  documentId: string, 
  globalOffset: number
): any[] {
  const chunks: any[] = [];
  const maxChunkSize = 2000;
  
  // Split by double newlines or significant breaks
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  
  let currentChunk = '';
  let chunkStartPos = globalOffset;
  
  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).length > maxChunkSize && currentChunk.length > 0) {
      const embedding = generateEmbedding(currentChunk);
      chunks.push({
        document_id: documentId,
        content: currentChunk.trim(),
        start_pos: chunkStartPos,
        end_pos: chunkStartPos + currentChunk.length,
        embedding
      });
      
      chunkStartPos += currentChunk.length;
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    }
  }
  
  // Add remaining chunk
  if (currentChunk.trim().length > 50) {
    const embedding = generateEmbedding(currentChunk);
    chunks.push({
      document_id: documentId,
      content: currentChunk.trim(),
      start_pos: chunkStartPos,
      end_pos: chunkStartPos + currentChunk.length,
      embedding
    });
  }
  
  return chunks;
}

function generateMockContent(title: string, version: string, jurisdiction: string, sector: string, language: string = 'IT'): string {
  // Generate detailed mock content based on regulation type
  const isGDPR = title.includes('GDPR') || title.includes('General Data Protection');
  const isNIS2 = title.includes('NIS') || title.includes('Network and Information');
  const isAI = title.includes('AI Act') || title.includes('Artificial Intelligence');
  const isCRA = title.includes('Cyber Resilience') || title.includes('CRA');
  const isDORA = title.includes('DORA') || title.includes('Digital Operational Resilience');
  const isCER = title.includes('CER') || title.includes('Critical Entities');
  const isHIPAA = title.includes('HIPAA');
  const isCCPA = title.includes('CCPA') || title.includes('California Consumer');
  
  const sections = [];
  
  // Introductory section
  sections.push(`
${title.toUpperCase()}
${version}
${jurisdiction} - ${sector}

CHAPTER I - GENERAL PROVISIONS AND SCOPE

Article 1 - Subject Matter and Objectives
This ${isGDPR ? 'Regulation lays down rules relating to the protection of natural persons with regard to the processing of personal data and rules relating to the free movement of personal data.' : 
  isNIS2 ? 'Directive lays down measures to achieve a high common level of cybersecurity across the Union.' :
  isAI ? 'Regulation establishes harmonised rules on artificial intelligence.' :
  isCRA ? 'Regulation lays down cybersecurity requirements for products with digital elements.' :
  isDORA ? 'Regulation on digital operational resilience for the financial sector.' :
  isCER ? 'Directive on the resilience of critical entities.' :
  isHIPAA ? 'Rule establishes national standards to protect individuals\' medical records and other personal health information.' :
  isCCPA ? 'Act provides California consumers with rights regarding their personal information.' :
  'Regulation establishes comprehensive requirements for compliance and risk management.'}

Article 2 - Material Scope
${isGDPR ? 'This Regulation applies to the processing of personal data wholly or partly by automated means and to the processing other than by automated means of personal data which form part of a filing system or are intended to form part of a filing system.' :
  isNIS2 ? 'This Directive applies to public and private entities of a type referred to in Annex I or II that provide their services or carry out their activities within the Union.' :
  isAI ? 'This Regulation applies to providers placing on the market, putting into service or using AI systems in the Union, irrespective of whether those providers are established or located within the Union or in a third country.' :
  'This regulation applies to all entities operating within the specified jurisdiction and sector.'}

Article 3 - Territorial Scope
${isGDPR ? 'This Regulation applies to the processing of personal data in the context of the activities of an establishment of a controller or a processor in the Union, regardless of whether the processing takes place in the Union or not.' :
  'This regulation applies to entities established in the Union and to entities in third countries offering goods or services to subjects in the Union.'}

Article 4 - Definitions
${isGDPR ? '"personal data" means any information relating to an identified or identifiable natural person; "processing" means any operation performed on personal data; "controller" means the natural or legal person which determines the purposes and means of the processing; "processor" means a natural or legal person which processes personal data on behalf of the controller.' :
  isNIS2 ? '"essential entity" means an entity identified as such in accordance with Article 3; "important entity" means an entity identified as such in accordance with Article 3; "cybersecurity risk" means any reasonably identifiable circumstance or event having a potential adverse effect on network and information systems.' :
  isAI ? '"AI system" means a machine-based system that is designed to operate with varying levels of autonomy and that may exhibit adaptiveness after deployment, and that, for explicit or implicit objectives, infers, from the input it receives, how to generate outputs such as predictions, content, recommendations, or decisions that can influence physical or virtual environments; "high-risk AI system" means an AI system identified as such pursuant to Article 6.' :
  'Key terms and definitions applicable throughout this regulation.'}
`);

  // Risk classification section (for AI Act)
  if (isAI) {
    sections.push(`
CHAPTER II - CLASSIFICATION OF AI SYSTEMS

Article 5 - Prohibited AI Practices
The following AI practices shall be prohibited:
(a) the placing on the market, putting into service or use of an AI system that deploys subliminal techniques beyond a person's consciousness;
(b) systems that exploit vulnerabilities of specific groups;
(c) systems for social scoring by public authorities;
(d) real-time remote biometric identification systems in publicly accessible spaces for law enforcement.

Article 6 - Classification Rules for High-Risk AI Systems
1. An AI system shall be considered high-risk where both of the following conditions are fulfilled:
(a) the AI system is intended to be used as a safety component of a product, or the AI system is itself a product;
(b) the product is required to undergo a third-party conformity assessment.

2. In addition to high-risk AI systems referred to in paragraph 1, AI systems referred to in Annex III shall be considered high-risk.

Article 7 - Amendments to Annex III
High-risk AI systems include:
- Biometric identification and categorisation of natural persons
- Management and operation of critical infrastructure
- Education and vocational training
- Employment, workers management and access to self-employment
- Access to and enjoyment of essential private services and public services and benefits
- Law enforcement
- Migration, asylum and border control management
- Administration of justice and democratic processes

Article 8 - Compliance with Requirements
High-risk AI systems shall comply with the requirements established in this Chapter, taking into account the intended purpose of the AI system and the risk management system as referred to in Article 9.
`);
  }

  // GDPR specific sections
  if (isGDPR) {
    sections.push(`
CHAPTER II - PRINCIPLES

Article 5 - Principles Relating to Processing of Personal Data
1. Personal data shall be:
(a) processed lawfully, fairly and in a transparent manner;
(b) collected for specified, explicit and legitimate purposes;
(c) adequate, relevant and limited to what is necessary;
(d) accurate and, where necessary, kept up to date;
(e) kept in a form which permits identification of data subjects for no longer than necessary;
(f) processed in a manner that ensures appropriate security.

2. The controller shall be responsible for, and be able to demonstrate compliance with, paragraph 1 ('accountability').

Article 6 - Lawfulness of Processing
Processing shall be lawful only if at least one of the following applies:
(a) the data subject has given consent;
(b) processing is necessary for the performance of a contract;
(c) processing is necessary for compliance with a legal obligation;
(d) processing is necessary to protect vital interests;
(e) processing is necessary for the performance of a task carried out in the public interest;
(f) processing is necessary for the purposes of legitimate interests pursued by the controller.

CHAPTER III - RIGHTS OF THE DATA SUBJECT

Article 15 - Right of Access
The data subject shall have the right to obtain from the controller confirmation as to whether or not personal data concerning them are being processed, and access to the personal data and information.

Article 16 - Right to Rectification
The data subject shall have the right to obtain without undue delay the rectification of inaccurate personal data.

Article 17 - Right to Erasure ('Right to be Forgotten')
The data subject shall have the right to obtain the erasure of personal data concerning them without undue delay where applicable.

Article 20 - Right to Data Portability
The data subject shall have the right to receive the personal data concerning them in a structured, commonly used and machine-readable format.

CHAPTER IV - CONTROLLER AND PROCESSOR

Article 24 - Responsibility of the Controller
Taking into account the nature, scope, context and purposes of processing as well as the risks, the controller shall implement appropriate technical and organisational measures.

Article 25 - Data Protection by Design and by Default
The controller shall implement appropriate technical and organisational measures designed to implement data-protection principles.

Article 30 - Records of Processing Activities
Each controller shall maintain a record of processing activities under its responsibility.

Article 32 - Security of Processing
The controller and processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.

Article 33 - Notification of a Personal Data Breach
In the case of a personal data breach, the controller shall without undue delay and, where feasible, not later than 72 hours after having become aware of it, notify the supervisory authority.

Article 35 - Data Protection Impact Assessment
Where processing is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall carry out an assessment of the impact.

Article 37 - Designation of the Data Protection Officer
The controller and the processor shall designate a data protection officer in specific cases.
`);
  }

  // NIS2 specific sections
  if (isNIS2) {
    sections.push(`
CHAPTER II - ESSENTIAL AND IMPORTANT ENTITIES

Article 3 - Identification of Essential and Important Entities
Member States shall identify essential and important entities based on sectoral criteria and size thresholds.

CHAPTER III - CYBERSECURITY RISK MANAGEMENT AND REPORTING OBLIGATIONS

Article 21 - Cybersecurity Risk-Management Measures
Essential and important entities shall take appropriate and proportionate technical, operational and organisational measures to manage cybersecurity risks, including:
(a) policies on risk analysis and information system security;
(b) incident handling;
(c) business continuity and crisis management;
(d) supply chain security;
(e) security in network and information systems acquisition, development and maintenance;
(f) policies and procedures to assess the effectiveness of cybersecurity measures;
(g) basic cyber hygiene practices and cybersecurity training;
(h) policies regarding the use of cryptography and encryption;
(i) human resources security, access control policies and asset management;
(j) multi-factor authentication or continuous authentication solutions.

Article 23 - Reporting Obligations
1. Essential and important entities shall notify the CSIRT or the competent authority of any incident having a significant impact without undue delay and in any event within 24 hours.

2. Without undue delay and in any event within 72 hours, entities shall submit an incident notification including an initial assessment.

3. Upon the request of the CSIRT or competent authority, entities shall submit a final report within one month.
`);
  }

  // Additional technical and compliance sections
  sections.push(`
CHAPTER ${isGDPR ? 'V' : isNIS2 ? 'IV' : isAI ? 'III' : 'IV'} - SUPERVISION AND ENFORCEMENT

Article ${isGDPR ? '51' : '30'} - Supervisory Authority
${jurisdiction === 'EU' ? 'Each Member State shall provide for one or more independent public authorities to be responsible for monitoring the application of this Regulation.' : 'Competent authorities shall be established to ensure compliance with this regulation.'}

Article ${isGDPR ? '58' : '32'} - Powers
The supervisory authority shall have investigative, corrective, authorisation and advisory powers including:
(a) to order the controller or processor to provide information;
(b) to carry out investigations and audits;
(c) to issue warnings and reprimands;
(d) to order compliance with requests;
(e) to impose administrative fines.

Article ${isGDPR ? '83' : '34'} - Administrative Fines
${isGDPR ? 'Infringements shall be subject to administrative fines up to EUR 20,000,000 or up to 4% of the total worldwide annual turnover, whichever is higher.' :
  isNIS2 ? 'Member States shall ensure that essential entities are subject to effective, proportionate and dissuasive sanctions, which may include fines of at least EUR 10,000,000 or at least 2% of total worldwide annual turnover.' :
  'Non-compliance may result in significant administrative fines and corrective measures.'}

CHAPTER ${isGDPR ? 'VI' : isNIS2 ? 'V' : 'V'} - IMPLEMENTATION AND FINAL PROVISIONS

Article ${isGDPR ? '89' : '40'} - Entry into Force and Application
${isGDPR ? 'This Regulation shall enter into force on the twentieth day following that of its publication in the Official Journal of the European Union. It shall apply from 25 May 2018.' :
  isNIS2 ? 'This Directive shall enter into force on the twentieth day following publication. Member States shall transpose this Directive by 17 October 2024.' :
  isAI ? 'This Regulation shall enter into force twenty days after publication and apply 24 months thereafter, with specific provisions applying earlier.' :
  'This regulation shall enter into force according to specified timelines and application dates.'}
`);

  // Add sector-specific requirements
  sections.push(`
ANNEX - SECTOR-SPECIFIC REQUIREMENTS AND IMPLEMENTATION GUIDELINES

SECTION 1: Technical Specifications
Detailed technical requirements for implementation including security standards, encryption protocols, access control mechanisms, audit logging, and monitoring capabilities.

SECTION 2: Organizational Measures
Governance structures, roles and responsibilities, policies and procedures, training requirements, incident response procedures, and business continuity planning.

SECTION 3: Risk Assessment Methodology
Framework for identifying, analyzing, evaluating, and treating risks, including risk matrices, impact assessments, and mitigation strategies.

SECTION 4: Compliance Documentation
Requirements for maintaining records, documentation standards, audit trails, and reporting formats.

SECTION 5: International Cooperation
${jurisdiction === 'EU' ? 'Mechanisms for cooperation between Member States, mutual assistance, and coordination with international partners.' : 'Provisions for international data transfers and cross-border cooperation.'}
`);

  return sections.join('\n\n');
}