import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AISentinelUpload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    modelType: "",
    sourceUrl: "",
    sourceOrganization: "",
    version: "",
    description: "",
  });

  // Calculate file hash (SHA-256) - simplified version for demo
  const calculateFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['pt', 'pth', 'onnx', 'pb', 'h5', 'safetensors', 'pkl', 'joblib'];
      
      if (!validExtensions.includes(extension || '')) {
        toast({
          title: "Formato non supportato",
          description: `Formati supportati: ${validExtensions.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // Auto-detect model type from extension
      const typeMapping: { [key: string]: string } = {
        'pt': 'pytorch',
        'pth': 'pytorch',
        'onnx': 'onnx',
        'pb': 'tensorflow',
        'h5': 'tensorflow',
        'safetensors': 'safetensors',
        'pkl': 'scikit-learn',
        'joblib': 'scikit-learn',
      };

      setFormData(prev => ({
        ...prev,
        name: prev.name || file.name,
        modelType: typeMapping[extension || ''] || 'other',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const fileInput = document.getElementById('model-file') as HTMLInputElement;
      const file = fileInput?.files?.[0];

      if (!file) {
        throw new Error('Nessun file selezionato');
      }

      // Calculate file hash
      const fileHash = await calculateFileHash(file);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      // Insert model record
      const { data: model, error: modelError } = await supabase
        .from('ai_models')
        .insert({
          user_id: user.id,
          name: formData.name,
          model_type: formData.modelType,
          file_size: file.size,
          file_hash: fileHash,
          status: 'pending',
          metadata: {
            original_filename: file.name,
            description: formData.description,
          }
        })
        .select()
        .single();

      if (modelError) throw modelError;

      // Insert provenance record if provided
      if (formData.sourceUrl || formData.sourceOrganization) {
        await supabase
          .from('model_provenance')
          .insert({
            model_id: model.id,
            source_url: formData.sourceUrl || null,
            source_organization: formData.sourceOrganization || null,
            version: formData.version || null,
            verification_status: 'unverified',
          });
      }

      toast({
        title: "Modello registrato con successo",
        description: "Puoi ora eseguire scansioni di sicurezza",
      });

      navigate(`/ai-sentinel/model/${model.id}`);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Errore durante il caricamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/ai-sentinel')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna a Sentinel
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-6 w-6" />
              Carica Modello AI
            </CardTitle>
            <CardDescription>
              Registra un modello AI per l'analisi di sicurezza e conformità
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="model-file">File Modello *</Label>
                <Input
                  id="model-file"
                  type="file"
                  accept=".pt,.pth,.onnx,.pb,.h5,.safetensors,.pkl,.joblib"
                  onChange={handleFileChange}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Formati supportati: PyTorch (.pt, .pth), ONNX (.onnx), TensorFlow (.pb, .h5), 
                  SafeTensors (.safetensors), Scikit-learn (.pkl, .joblib)
                </p>
              </div>

              {/* Model Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome Modello *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="es. Customer Churn Predictor v2.1"
                  required
                />
              </div>

              {/* Model Type */}
              <div className="space-y-2">
                <Label htmlFor="modelType">Tipo Framework *</Label>
                <Select
                  value={formData.modelType}
                  onValueChange={(value) => setFormData({ ...formData, modelType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pytorch">PyTorch</SelectItem>
                    <SelectItem value="tensorflow">TensorFlow</SelectItem>
                    <SelectItem value="onnx">ONNX</SelectItem>
                    <SelectItem value="safetensors">SafeTensors</SelectItem>
                    <SelectItem value="scikit-learn">Scikit-learn</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione del modello, caso d'uso, training data..."
                  rows={3}
                />
              </div>

              {/* Provenance Section */}
              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Supply Chain & Provenance (Opzionale)
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="sourceOrganization">Organizzazione Sorgente</Label>
                  <Input
                    id="sourceOrganization"
                    value={formData.sourceOrganization}
                    onChange={(e) => setFormData({ ...formData, sourceOrganization: e.target.value })}
                    placeholder="es. HuggingFace, OpenAI, Internal Team"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">URL Sorgente</Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    value={formData.sourceUrl}
                    onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                    placeholder="https://huggingface.co/model-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">Versione</Label>
                  <Input
                    id="version"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="es. v2.1.0"
                  />
                </div>
              </div>

              {/* Warning Box */}
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Nota sulla sicurezza</p>
                      <p className="text-muted-foreground">
                        Il modello verrà analizzato automaticamente per rilevare vulnerabilità, 
                        backdoor e conformità normativa. I file non vengono caricati su storage 
                        esterno, vengono processati solo i metadati e l'hash crittografico.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/ai-sentinel')}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? 'Registrazione...' : 'Registra Modello'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AISentinelUpload;
