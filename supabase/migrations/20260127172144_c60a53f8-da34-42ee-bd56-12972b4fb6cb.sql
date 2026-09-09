-- Add annual revenue column to compliance_assessments table
ALTER TABLE public.compliance_assessments 
ADD COLUMN annual_revenue_eur numeric NULL;

-- Add a comment to explain the column purpose
COMMENT ON COLUMN public.compliance_assessments.annual_revenue_eur IS 'Annual company revenue in EUR, used to calculate potential fines based on regulatory requirements (e.g., GDPR fines up to 4% of annual turnover)';