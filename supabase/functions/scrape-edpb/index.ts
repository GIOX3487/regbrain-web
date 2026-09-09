import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log('Starting EDPB scraping...');

    // Fetch the guidelines page
    const guidelinesPage = await fetch('https://www.edpb.europa.eu/our-work-tools/our-documents/publication-type/guidelines_en');
    const html = await guidelinesPage.text();

    console.log('Fetched guidelines page');

    // Extract guideline links using regex (simplified approach)
    // In production, you'd want to use a proper HTML parser
    const linkRegex = /href="(\/our-work-tools\/[^"]+guidelines[^"]+)"/g;
    const links = new Set<string>();
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const path = match[1];
      if (!path.includes('public-consultations')) {
        links.add(`https://www.edpb.europa.eu${path}`);
      }
    }

    console.log(`Found ${links.size} guideline pages`);

    let processedCount = 0;
    const errors: string[] = [];

    // Process each guideline page
    for (const link of Array.from(links).slice(0, 10)) { // Limit to 10 for testing
      try {
        console.log(`Processing: ${link}`);
        
        const pageResponse = await fetch(link);
        const pageHtml = await pageResponse.text();

        // Extract PDF links
        const pdfRegex = /href="(\/system\/files\/[^"]+\.pdf)"/g;
        let pdfMatch;
        
        while ((pdfMatch = pdfRegex.exec(pageHtml)) !== null) {
          const pdfUrl = `https://www.edpb.europa.eu${pdfMatch[1]}`;
          
          // Extract title from PDF filename
          const filename = pdfUrl.split('/').pop() || '';
          const title = filename
            .replace('.pdf', '')
            .replace(/_/g, ' ')
            .replace(/edpb/gi, 'EDPB')
            .replace(/gdpr/gi, 'GDPR');

          console.log(`Found PDF: ${title}`);

          // Check if already exists
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('title', title)
            .eq('source_url', pdfUrl)
            .single();

          if (!existing) {
            // Call process-document function with user auth token
            const { error: processError } = await supabase.functions.invoke('process-document', {
              body: {
                pdf_url: pdfUrl,
                title,
                version: '1.0',
                jurisdiction: 'EU',
                sector: 'general',
                source_url: link,
                language: 'EN',
              },
              headers: {
                Authorization: authHeader || '',
              }
            });

            if (processError) {
              console.error(`Error processing ${title}:`, processError);
              errors.push(`${title}: ${processError.message}`);
            } else {
              processedCount++;
              console.log(`Successfully processed: ${title}`);
            }

            // Add delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 seconds
          } else {
            console.log(`Skipping existing document: ${title}`);
          }
        }
      } catch (error: any) {
        console.error(`Error processing link ${link}:`, error);
        errors.push(`${link}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Processed ${processedCount} new guidelines from EDPB`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error scraping EDPB:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
