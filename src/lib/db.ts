import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  product_charges?: ProductCharge[];
}

export interface ProductCharge {
  id?: string;
  product_id: string;
  name: string;
  description?: string;
  amount: number;
  created_at?: string;
}

// Type definitions for our database tables
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  company?: string;
  position?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  tax_id?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  is_approved?: boolean;
  onboarding_token?: string;
  registration_docs?: string[] | null;
  storage_provider?: 'supabase' | 'r2';
}

export interface Destination {
  id: string;
  country: string;
  port?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

export interface FreightRate {
  id: string;
  destination_id: string;
  min_weight?: number | null;
  max_weight?: number | null;
  base_rate: number;
  effective_date?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

// Define Pallet and AdditionalCharge interfaces locally if they are not exported from db.ts
export interface Pallet {
  length: number | string;
  width: number | string;
  height: number | string;
  weight: number | string;
  quantity: number | string;
  overridden_rate?: number | string;
}

export interface AdditionalCharge {
  name: string;
  description: string;
  amount: number | string; // Allow string as well for form input
}

export interface Quotation {
  id: string;
  created_at: string;
  user_id: string;
  company_id: string;
  opportunity_id?: string | null; // Added field
  product_id?: string | null; // Added field
  customer_name: string;
  contact_person: string;
  contract_no?: string | null;
  destination_id: string;
  shipping_date?: string | null;
  pallets: Pallet[]; // Use defined type
  delivery_service_required: boolean;
  delivery_vehicle_type: '4wheel' | '6wheel';
  additional_charges: AdditionalCharge[]; // Use defined type
  notes?: string | null;
  total_cost: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'docs_uploaded' | 'completed' | 'Shipped' | 'pending_approval';
  company_name?: string | null;
  destination?: string | null;
  requested_destination?: string | null;
  updated_at?: string;
  completed_at?: string | null;
  shipment_photo_url?: string[] | null;
  shipment_photo_uploaded_at?: string | null;

  // Additional cost breakdown fields
  total_freight_cost?: number | null; // Allow null
  clearance_cost?: number | null; // Allow null
  delivery_cost?: number | null; // Allow null

  // Weight calculation fields
  total_actual_weight?: number | null; // Allow null
  total_volume_weight?: number | null; // Allow null
  chargeable_weight?: number | null; // Allow null
  internal_remark?: string | null; // Added field
  required_doc_types?: string[] | null; // Added field for tracking required documents
  customer_user_id?: string | null; // Assigned customer user ID
  quotation_no?: string; // Auto-generated quotation number

  // AWB & Customs Declaration - uploaded by staff
  awb_file_url?: string | null;
  awb_file_name?: string | null;
  awb_uploaded_at?: string | null;
  customs_declaration_file_url?: string | null;
  customs_declaration_file_name?: string | null;
  customs_declaration_uploaded_at?: string | null;

  share_token?: string | null;
  storage_provider?: 'supabase' | 'r2';

  opportunities?: {
    stage: string;
    closure_status?: string | null;
  } | null;
}

export interface DocumentSubmission {
  id: string;
  quotation_id: string;
  company_name: string;
  document_type: string;
  document_type_name?: string;
  document_type_id?: string;
  category?: string;
  file_name: string;
  original_file_name?: string;
  file_path?: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  notes?: string;
  status?: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  description?: string; // AI-generated document summary
  storage_provider?: 'supabase' | 'r2';
}

export interface Setting {
  id: string;
  category: string;
  settings_key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings_value?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

// ============================================================
// CUSTOMER ASSIGNMENT FUNCTIONS
// ============================================================

/**
 * ดึง customer ทั้งหมดสำหรับ dropdown assign
 */
export async function getCustomerUsers(): Promise<{ id: string; email: string; full_name: string; company: string }[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, company, role')
      .eq('role', 'customer')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching customer users:', error);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      email: p.email || '',
      full_name: p.full_name || '',
      company: p.company || '',
    }));
  } catch (error) {
    console.error('Error in getCustomerUsers:', error);
    return [];
  }
}

/**
 * Assign customer ให้กับ quotation
 */
export async function assignCustomerToQuotation(quotationId: string, customerUserId: string | null): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('quotations')
      .update({ customer_user_id: customerUserId })
      .eq('id', quotationId);

    if (error) {
      console.error('Error assigning customer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in assignCustomerToQuotation:', error);
    return false;
  }
}

// PROFILE FUNCTIONS
export async function getProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile;
  } catch (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any
  ) {
    console.error('Error in getProfile:', error);
    return null;
  }
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return null;
  }
}

// COMPANY FUNCTIONS
export async function getCompanies() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching companies:', error);
      return null;
    }

    return data as Company[];
  } catch (error) {
    console.error('Error in getCompanies:', error);
    return null;
  }
}

// Fetch a single company by onboarding token (Public access)
export async function getCompanyByToken(token: string): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('onboarding_token', token)
      .single();

    if (error) {
      console.error('Error fetching company by token:', error);
      return null;
    }

    return data as Company;
  } catch (error) {
    console.error('Unexpected error fetching company by token:', error);
    return null;
  }
}

export async function getCompanyById(id: string) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching company:', error);
      return null;
    }

    return data as Company;
  } catch (error) {
    console.error('Error in getCompanyById:', error);
    return null;
  }
}

export async function createCompany(company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .insert([company])
      .select();

    if (error) {
      console.error('Error creating company:', error);
      return null;
    }

    return data[0] as Company;
  } catch (error) {
    console.error('Error in createCompany:', error);
    return null;
  }
}

export async function updateCompany(id: string, updates: Partial<Company>) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating company:', error);
      return null;
    }

    return data[0] as Company;
  } catch (error) {
    console.error('Error in updateCompany:', error);
    return null;
  }
}

export async function deleteCompany(id: string) {
  try {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting company:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteCompany:', error);
    return false;
  }
}

// DESTINATION FUNCTIONS
export async function getDestinations() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('destinations')
      .select('id, country, port')
      .eq('user_id', user.id)
      .order('country', { ascending: true });

    if (error) {
      console.error('Error fetching destinations:', error);
      return [];
    }

    return data as Pick<Destination, 'id' | 'country' | 'port'>[];
  } catch (error) {
    console.error('Error in getDestinations:', error);
    return [];
  }
}

export async function getDestinationById(id: string) {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('id, country, port')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching destination:', error);
      return null;
    }

    return data as Pick<Destination, 'id' | 'country' | 'port'>;
  } catch (error) {
    console.error('Error in getDestinationById:', error);
    return null;
  }
}

export async function createDestination(destination: Omit<Destination, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("User not authenticated to create destination.");
    }

    const dataToSave = {
      country: destination.country,
      port: destination.port || null,
      user_id: userId
    };

    const { data, error } = await supabase
      .from('destinations')
      .insert([dataToSave])
      .select('id, country, port');

    if (error) {
      console.error('Error creating destination:', error);
      return null;
    }

    return data[0] as Destination;
  } catch (error) {
    console.error('Error in createDestination:', error);
    return null;
  }
}

export async function updateDestination(id: string, updates: Partial<Pick<Destination, 'country' | 'port'>>) {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .update(updates)
      .eq('id', id)
      .select('id, country, port');

    if (error) {
      console.error('Error updating destination:', error);
      return null;
    }

    return data[0] as Destination;
  } catch (error) {
    console.error('Error in updateDestination:', error);
    return null;
  }
}

export async function deleteDestination(id: string) {
  try {
    const { error } = await supabase
      .from('destinations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting destination:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDestination:', error);
    return false;
  }
}

// FREIGHT RATE FUNCTIONS
export async function getFreightRates() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('freight_rates')
      .select(`
        id, destination_id, min_weight, max_weight, base_rate, effective_date, user_id,
        destinations ( country, port )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching freight rates:', error);
      return [];
    }

    return data as (Pick<FreightRate, 'id' | 'destination_id' | 'min_weight' | 'max_weight' | 'base_rate' | 'effective_date' | 'user_id'> & {
      destinations: Pick<Destination, 'country' | 'port'>[] | null;
    })[];
  } catch (error) {
    console.error('Error in getFreightRates:', error);
    return [];
  }
}

export async function getFreightRateById(id: string) {
  try {
    const { data, error } = await supabase
      .from('freight_rates')
      .select(`
         id, destination_id, min_weight, max_weight, base_rate, effective_date, user_id,
         destinations ( country, port )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching freight rate:', error);
      return null;
    }

    return data as Pick<FreightRate, 'id' | 'destination_id' | 'min_weight' | 'max_weight' | 'base_rate' | 'effective_date' | 'user_id'> & {
      destinations: Pick<Destination, 'country' | 'port'>[] | null;
    };
  } catch (error) {
    console.error('Error in getFreightRateById:', error);
    return null;
  }
}

export async function createFreightRate(rate: Omit<FreightRate, 'id' | 'created_at' | 'updated_at' | 'currency' | 'vehicle_type' | 'container_size'>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error("User not authenticated to create freight rate.");
    }

    const dataToSave = {
      destination_id: rate.destination_id,
      min_weight: rate.min_weight,
      max_weight: rate.max_weight,
      base_rate: rate.base_rate,
      effective_date: rate.effective_date,
      user_id: userId
    };

    const { data, error } = await supabase
      .from('freight_rates')
      .insert([dataToSave])
      .select();

    if (error) {
      console.error('Error creating freight rate:', error);
      return null;
    }

    return data[0] as FreightRate;
  } catch (error) {
    console.error('Error in createFreightRate:', error);
    return null;
  }
}

export async function updateFreightRate(id: string, updates: Partial<Omit<FreightRate, 'currency' | 'vehicle_type' | 'container_size'>>) {
  try {
    // Disable unused vars check for this line as destructuring is used to exclude fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, destination_id, id: rateId, created_at, updated_at, ...restUpdates } = updates;

    const { data, error } = await supabase
      .from('freight_rates')
      .update(restUpdates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating freight rate:', error);
      return null;
    }

    return data[0] as FreightRate;
  } catch (error: unknown) {
    console.error('Exception in updateFreightRate:', error);
    return null;
  }
}

export async function deleteFreightRate(id: string) {
  try {
    const { error } = await supabase
      .from('freight_rates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting freight rate:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteFreightRate:', error);
    return false;
  }
}

// QUOTATION FUNCTIONS
export async function getQuotations(userId: string) {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        company:companies(name),
        destination_country:destinations(country, port),
        product:products(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotations:', error);
      return []; // Return empty array on error
    }

    // Transform data to match Quotation interface, especially for nested objects
    const transformedData = data.map(q => ({
      ...q,
      company_name: q.company?.name,
      destination: q.destination_country ? `${q.destination_country.country} ${q.destination_country.port ? '- ' + q.destination_country.port : ''}` : 'N/A',
      // shipment_photo_url should already be an array if the DB column type is TEXT[]
      // shipment_photo_uploaded_at should be a string for timestamp
    }));

    return transformedData as Quotation[];
  } catch (err) {
    console.error('Error in getQuotations:', err);
    return [];
  }
}

/**
 * ดึง pending_approval quotations ที่ลูกค้าสร้าง (สำหรับ staff)
 */
export async function getPendingApprovalQuotations(): Promise<Quotation[]> {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending approval quotations:', error);
      return [];
    }

    return (data || []) as Quotation[];
  } catch (err) {
    console.error('Error in getPendingApprovalQuotations:', err);
    return [];
  }
}

/**
 * Approve customer quote request — staff fills in destination, company, rate and approves
 */
export async function approveQuoteRequest(
  quotationId: string,
  staffUserId: string,
  updates: {
    company_id?: string;
    destination_id?: string;
    destination?: string;
    company_name?: string;
    status: string;
    [key: string]: unknown;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('quotations')
      .update({
        ...updates,
        user_id: staffUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotationId)
      .eq('status', 'pending_approval');

    if (error) {
      console.error('Error approving quote request:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in approveQuoteRequest:', err);
    return false;
  }
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        company:companies(name, address, tax_id, contact_person, contact_email, contact_phone),
        destination_country:destinations(country, port),
        product:products(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching quotation by ID:', error);
      return null;
    }
    if (!data) return null;

    // Transform data to match Quotation interface
    const quotation: Quotation = {
      ...data,
      company_name: data.company?.name,
      destination: data.destination_country ? `${data.destination_country.country} ${data.destination_country.port ? '- ' + data.destination_country.port : ''} ` : 'N/A',
      // Ensure shipment_photo_url and shipment_photo_uploaded_at are correctly typed here if needed
      // If the database returns shipment_photo_url as a string that looks like an array (e.g., "{\"url1\",\"url2\"}"),
      // you might need to parse it here. However, Supabase usually handles TEXT[] as JS arrays directly.
    };

    return quotation;
  } catch (err) {
    console.error('Error in getQuotationById:', err);
    return null;
  }
}

// Type for creating a new quotation (without DB-generated fields)
export type NewQuotationData = Omit<Quotation, 'id' | 'created_at' | 'updated_at'>;

export async function saveQuotation(quotationData: NewQuotationData): Promise<Quotation | null> {
  try {
    console.log('Saving new quotation:', quotationData);

    // Check for required fields
    if (!quotationData.user_id || !quotationData.company_id || !quotationData.destination_id) {
      console.error('Missing required fields for quotation:',
        !quotationData.user_id ? 'user_id' : '',
        !quotationData.company_id ? 'company_id' : '',
        !quotationData.destination_id ? 'destination_id' : ''
      );
      throw new Error('Missing required fields for quotation');
    }

    // Ensure pallets is a valid array
    if (!Array.isArray(quotationData.pallets) || quotationData.pallets.length === 0) {
      console.error('Invalid or empty pallets array');
      throw new Error('At least one pallet is required');
    }

    // Prepare data - sanitize any fields that could cause database issues
    const sanitizedData = {
      ...quotationData,
      // Convert any undefined values to null for PostgreSQL compatibility
      contract_no: quotationData.contract_no || null,
      notes: quotationData.notes || null,
      opportunity_id: quotationData.opportunity_id || null, // Added field
      product_id: quotationData.product_id || null, // Added field
      internal_remark: quotationData.internal_remark || null, // Added field
      required_doc_types: Array.isArray(quotationData.required_doc_types) ? quotationData.required_doc_types : null, // Added field
      // Ensure JSONB fields are properly formatted
      pallets: Array.isArray(quotationData.pallets) ? quotationData.pallets : [],
      additional_charges: Array.isArray(quotationData.additional_charges) ? quotationData.additional_charges : []
    };

    const { data, error } = await supabase
      .from('quotations')
      .insert([sanitizedData])
      .select() // Select all columns of the newly created row
      .single(); // Expecting one row back

    if (error) {
      console.error('Error saving quotation:', error);

      // More detailed error reporting based on error type
      if (error.code === '23505') {
        console.error('Unique constraint violation. A record with these values already exists.');
        throw new Error('A quotation with these details already exists');
      } else if (error.code === '23503') {
        console.error('Foreign key constraint violation. Referenced record does not exist.');
        throw new Error('One of the referenced records (company, destination) does not exist');
      } else if (error.code === '23502') {
        console.error('Not null constraint violation. A required field is missing.');
        throw new Error('A required field is missing');
      } else {
        // Generic database error
        throw new Error(`Database error: ${error.message || 'Unknown error'} `);
      }
    }

    if (!data) {
      console.error('No data returned after saving quotation, though no error reported.');
      throw new Error('Failed to save quotation - no data returned');
    }

    console.log('Quotation saved successfully:', data);
    // Cast the returned data to the full Quotation type
    return data as Quotation;

  } catch (error: unknown) {
    console.error('Exception in saveQuotation:', error);
    // Return null to indicate failure, with error message logged
    if (error instanceof Error && error.message) {
      console.error('Error message:', error.message);
    }
    throw error; // Throw the error so the calling function can handle it
  }
}

// Update the Quotation in the database
// Accepts a partial Quotation object, but ensure it matches the updated interface
export async function updateQuotation(id: string, updates: Partial<Omit<Quotation, 'id' | 'created_at' | 'user_id'>>): Promise<Quotation | null> {
  try {
    console.log('Updating quotation:', id, updates);

    const { data, error } = await supabase
      .from('quotations')
      .update(updates)
      .eq('id', id)
      .select()
      .single(); // Expecting a single row back

    if (error) {
      console.error('Error updating quotation:', error);
      // Check for specific errors like RLS violation or not found
      if (error.code === 'PGRST204') { // PostgREST: No rows found
        console.warn(`Quotation with ID ${id} not found for update.`);
        return null;
      }
      throw error; // Re-throw other errors
    }

    console.log('Quotation updated successfully:', data);
    return data as Quotation; // Cast to the full Quotation type

  } catch (error) {
    console.error('Exception in updateQuotation:', error);
    return null;
  }
}

/**
 * ดึง quotations ที่ยังไม่ได้ผูกกับ opportunity ใดเลย
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getUnlinkedQuotations(userId?: string): Promise<Quotation[]> {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select(`
        *,
        company:companies(name),
        destination_country:destinations(country, port)
      `)
      .is('opportunity_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unlinked quotations:', error);
      return [];
    }

    const transformedData = (data || []).map(q => ({
      ...q,
      company_name: q.company?.name || q.company_name,
      destination: q.destination_country
        ? `${q.destination_country.country}${q.destination_country.port ? ' - ' + q.destination_country.port : ''}`
        : q.destination || 'N/A',
    }));

    return transformedData as Quotation[];
  } catch (err) {
    console.error('Error in getUnlinkedQuotations:', err);
    return [];
  }
}

/**
 * ผูก quotation เข้ากับ opportunity (manual link)
 */
export async function linkQuotationToOpportunity(quotationId: string, opportunityId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('quotations')
      .update({
        opportunity_id: opportunityId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotationId);

    if (error) {
      console.error('Error linking quotation to opportunity:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in linkQuotationToOpportunity:', err);
    return false;
  }
}

/**
 * ยกเลิกการผูก quotation ออกจาก opportunity
 */
export async function unlinkQuotationFromOpportunity(quotationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('quotations')
      .update({
        opportunity_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotationId);

    if (error) {
      console.error('Error unlinking quotation from opportunity:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in unlinkQuotationFromOpportunity:', err);
    return false;
  }
}

/**
 * สร้าง share token สำหรับ public tracking link
 * ถ้ามี token อยู่แล้วจะ return token เดิม
 */
export async function generateShareToken(quotationId: string): Promise<string | null> {
  try {
    // Check if token already exists
    const { data: existing } = await supabase
      .from('quotations')
      .select('share_token')
      .eq('id', quotationId)
      .single();

    if (existing?.share_token) {
      return existing.share_token;
    }

    // Generate new token
    const token = crypto.randomUUID();

    const { error } = await supabase
      .from('quotations')
      .update({ share_token: token })
      .eq('id', quotationId);

    if (error) {
      console.error('Error generating share token:', error);
      return null;
    }

    return token;
  } catch (err) {
    console.error('Error in generateShareToken:', err);
    return null;
  }
}

/**
 * ดึง quotation จาก share token (สำหรับ public tracking — ไม่ต้อง auth)
 */
export async function getQuotationByShareToken(token: string): Promise<(Quotation & { documents?: DocumentSubmission[] }) | null> {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('*, opportunities(stage, closure_status)')
      .eq('share_token', token)
      .single();

    if (error) {
      console.error('Error fetching quotation by share token:', error);
      return null;
    }

    if (!data) return null;

    const { data: docs } = await supabase
      .from('document_submissions')
      .select('*')
      .eq('quotation_id', data.id)
      .order('submitted_at', { ascending: false });

    return { ...data, documents: docs || [] } as (Quotation & { documents?: DocumentSubmission[] }) | null;
  } catch (err) {
    console.error('Error in getQuotationByShareToken:', err);
    return null;
  }
}

export async function deleteQuotation(id: string) {
  try {
    const { error } = await supabase
      .from('quotations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting quotation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteQuotation:', error);
    return false;
  }
}

// DOCUMENT SUBMISSION FUNCTIONS
export async function getDocumentSubmissions(quotationId?: string) {
  try {
    let query = supabase
      .from('document_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (quotationId) {
      query = query.eq('quotation_id', quotationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching document submissions:', error);
      return [];
    }

    return data as DocumentSubmission[];
  } catch (error) {
    console.error('Error in getDocumentSubmissions:', error);
    return [];
  }
}

export async function getDocumentSubmissionById(id: string) {
  try {
    const { data, error } = await supabase
      .from('document_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching document submission:', error);
      return null;
    }

    return data as DocumentSubmission;
  } catch (error) {
    console.error('Error in getDocumentSubmissionById:', error);
    return null;
  }
}

export async function createDocumentSubmission(submission: Omit<DocumentSubmission, 'id' | 'submitted_at'>) {
  try {
    const { data, error } = await supabase
      .from('document_submissions')
      .insert([submission])
      .select();

    if (error) {
      console.error('Error creating document submission:', error);
      return null;
    }

    return data[0] as DocumentSubmission;
  } catch (error) {
    console.error('Error in createDocumentSubmission:', error);
    return null;
  }
}

export async function updateDocumentSubmission(id: string, updates: Partial<DocumentSubmission>) {
  try {
    console.log('🔍 updateDocumentSubmission called with:');
    console.log('- Document ID:', id);
    console.log('- Updates:', updates);

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    console.log('👤 Current user session:', session ? 'User logged in' : 'No user session');
    console.log('👤 User ID:', session?.user?.id || 'None');

    const { data, error } = await supabase
      .from('document_submissions')
      .update(updates)
      .eq('id', id)
      .select();

    console.log('📊 Supabase response:');
    console.log('- Data:', data);
    console.log('- Error:', error);

    if (error) {
      console.error('❌ Error updating document submission:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error('⚠️ No document found with ID:', id);
      console.log('🔍 This could be due to:');
      console.log('  1. Document ID does not exist');
      console.log('  2. Row Level Security (RLS) policy blocking update');
      console.log('  3. User does not have permission to update this document');
      return null;
    }

    console.log('✅ Document updated successfully:', data[0]);
    return data[0] as DocumentSubmission;
  } catch (error) {
    console.error('❌ Error in updateDocumentSubmission:', error);
    return null;
  }
}

export async function deleteDocumentSubmission(id: string) {
  try {
    const { deleteFile } = await import('@/lib/storage');

    // 1. Fetch document data first to get file path and provider
    const { data: doc, error: fetchError } = await supabase
      .from('document_submissions')
      .select('file_path, file_url, storage_provider')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching document before deletion:', fetchError);
      // Proceed with record deletion anyway if needed, but safer to return false
      return false;
    }

    // 2. Delete the physical file from storage (R2 or Supabase)
    const filePath = doc.file_path || doc.file_url;
    if (filePath) {
      const isPath = typeof filePath === 'string' && !filePath.startsWith('http');
      const provider = doc.storage_provider || (isPath ? 'r2' : 'supabase');

      // Document submissions are typically in 'documents' bucket
      await deleteFile('documents', filePath, provider);
      console.log(`Deleted file from ${provider}: ${filePath}`);
    }

    // 3. Delete from database
    const { error } = await supabase
      .from('document_submissions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting document submission:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDocumentSubmission:', error);
    return false;
  }
}

// SETTINGS FUNCTIONS
export async function getSettings(category?: string) {
  try {
    let query = supabase
      .from('settings')
      .select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching settings:', error);
      return [];
    }

    return data as Setting[];
  } catch (error) {
    console.error('Error in getSettings:', error);
    return [];
  }
}

export async function getSetting(category: string, key: string) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('category', category)
      .eq('settings_key', key)
      .single();

    if (error) {
      console.error('Error fetching setting:', error);
      return null;
    }

    return data as Setting;
  } catch (error) {
    console.error('Error in getSetting:', error);
    return null;
  }
}

export async function createOrUpdateSetting(
  category: string,
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: Record<string, any>,
  userId: string
) {
  try {
    const { data: existingSetting } = await supabase
      .from('settings')
      .select('*')
      .eq('category', category)
      .eq('settings_key', key)
      .maybeSingle();

    if (existingSetting) {
      const { data, error } = await supabase
        .from('settings')
        .update({
          settings_value: value,
          user_id: userId
        })
        .eq('id', existingSetting.id)
        .select();

      if (error) {
        console.error('Error updating setting:', error);
        return null;
      }

      return data[0] as Setting;
    } else {
      const { data, error } = await supabase
        .from('settings')
        .insert([{
          category,
          settings_key: key,
          settings_value: value,
          user_id: userId
        }])
        .select();

      if (error) {
        console.error('Error creating setting:', error);
        return null;
      }

      return data[0] as Setting;
    }
  } catch (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any
  ) {
    console.error('Error in createOrUpdateSetting:', error);
    return null;
  }
}

export async function deleteSetting(id: string) {
  try {
    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting setting:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteSetting:', error);
    return false;
  }
}

// Function to get document template by document type ID
export async function getDocumentTemplate(documentTypeId: string) {
  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('document_type_id', documentTypeId)
      .single();

    if (error) {
      console.error('Error fetching document template:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Failed to fetch document template:', err);
    return null;
  }
}

// Product Master Functions
export async function getProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_charges(*)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data as Product[];
  } catch (err) {
    console.error('Failed to fetch products:', err);
    return [];
  }
}

export async function getProductWithCharges(id: string) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_charges(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }
    return data as Product;
  } catch (err) {
    console.error('Failed to fetch product:', err);
    return null;
  }
}

export async function saveProductWithCharges(
  productData: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'product_charges'>,
  charges: Omit<ProductCharge, 'id' | 'product_id' | 'created_at'>[],
  productId?: string
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;

    let id = productId;

    // 1. Save or Update Product
    if (productId) {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          ...productData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateError) throw updateError;
    } else {
      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          ...productData,
          user_id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      id = newProduct.id;
    }

    if (!id) throw new Error('Failed to get product ID');

    // 2. Manage Charges (Delete old ones and insert new ones for simplicity in this master-detail save)
    if (productId) {
      const { error: deleteError } = await supabase
        .from('product_charges')
        .delete()
        .eq('product_id', id);

      if (deleteError) throw deleteError;
    }

    if (charges.length > 0) {
      const chargesToInsert = charges.map(c => ({
        ...c,
        product_id: id,
      }));

      const { error: chargesError } = await supabase
        .from('product_charges')
        .insert(chargesToInsert);

      if (chargesError) throw chargesError;
    }

    return id;
  } catch (err) {
    console.error('Failed to save product:', err);
    throw err;
  }
}

export async function deleteProduct(id: string) {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to delete product:', err);
    return false;
  }
}

export async function getProductDocumentTemplates(productId: string): Promise<{ document_type_id: string }[]> {
  try {
    const { data, error } = await supabase
      .from('product_document_templates')
      .select('document_type_id')
      .eq('product_id', productId)
      .order('sort_order');

    if (error) {
      console.error('Error fetching product document templates:', error);
      return [];
    }
    return (data || []) as { document_type_id: string }[];
  } catch (err) {
    console.error('Failed to get product document templates:', err);
    return [];
  }
}