import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://lxvkqylmsowibxajalyj.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dmtxeWxtc293aWJ4YWphbHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4ODc5NjQsImV4cCI6MjA5NzQ2Mzk2NH0.QZmmpSTrwD-CKLLgnYYFys00gEleTnk__m7x7gNy2Eg';

export const supabase = createClient(supabaseUrl, supabaseKey);
