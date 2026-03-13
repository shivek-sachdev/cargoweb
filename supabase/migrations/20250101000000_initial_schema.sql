-- สร้างตาราง users (ใช้ตาราง auth.users ที่มีอยู่แล้วใน Supabase)
-- แต่จะสร้าง profiles เพื่อเก็บข้อมูลเพิ่มเติมของผู้ใช้

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  position TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- สร้างตาราง companies สำหรับเก็บข้อมูลบริษัท/ลูกค้า
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  tax_id TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- สร้างตาราง destinations สำหรับเก็บข้อมูลประเทศปลายทาง
CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country TEXT NOT NULL,
  port TEXT,
  shipping_time INT, -- จำนวนวันที่ใช้ในการขนส่ง
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- สร้างตาราง delivery_services สำหรับเก็บข้อมูลบริการจัดส่ง
CREATE TABLE delivery_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  service_type TEXT NOT NULL, -- เช่น air, sea, road, etc.
  contact_info TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- สร้างตาราง freight_rates สำหรับเก็บอัตราค่าขนส่ง
CREATE TABLE freight_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_service_id UUID REFERENCES delivery_services(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL, -- ประเภทยานพาหนะ
  container_size TEXT, -- ขนาดตู้คอนเทนเนอร์
  base_rate DECIMAL(12, 2) NOT NULL, -- อัตราค่าขนส่งพื้นฐาน
  additional_charges JSONB, -- ค่าใช้จ่ายเพิ่มเติม
  currency TEXT DEFAULT 'THB',
  effective_date DATE NOT NULL, -- วันที่เริ่มมีผล
  expiry_date DATE, -- วันหมดอายุ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- สร้างตาราง quotations สำหรับเก็บข้อมูลใบเสนอราคา
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_no TEXT NOT NULL UNIQUE, -- เลขที่ใบเสนอราคา
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  delivery_service_id UUID REFERENCES delivery_services(id) ON DELETE SET NULL,
  freight_rate_id UUID REFERENCES freight_rates(id) ON DELETE SET NULL,
  vehicle_type TEXT,
  container_size TEXT,
  product_details JSONB, -- รายละเอียดสินค้า
  weight DECIMAL(10, 2), -- น้ำหนัก
  volume DECIMAL(10, 2), -- ปริมาตร
  customs_fee DECIMAL(12, 2), -- ค่าศุลกากร
  handling_fee DECIMAL(12, 2), -- ค่าดำเนินการ
  transport_fee DECIMAL(12, 2), -- ค่าขนส่ง
  documentation_fee DECIMAL(12, 2), -- ค่าเอกสาร
  insurance_fee DECIMAL(12, 2), -- ค่าประกัน
  other_fees JSONB, -- ค่าใช้จ่ายอื่นๆ
  discount DECIMAL(12, 2) DEFAULT 0, -- ส่วนลด
  total_cost DECIMAL(12, 2) NOT NULL, -- ราคารวมทั้งหมด
  currency TEXT DEFAULT 'THB',
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected
  notes TEXT,
  validity_days INT DEFAULT 30, -- ระยะเวลาที่ใบเสนอราคามีผล (วัน)
  expiry_date DATE, -- วันหมดอายุของใบเสนอราคา
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- สร้างตาราง document_submissions สำหรับเก็บข้อมูลเอกสารที่ลูกค้าอัปโหลด
CREATE TABLE document_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  status TEXT DEFAULT 'submitted', -- submitted, reviewed, approved, rejected
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- สร้างตาราง settings สำหรับเก็บการตั้งค่าต่างๆ ของระบบ
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL, -- general, invoice, email, etc.
  settings_key TEXT NOT NULL,
  settings_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Triggers สำหรับอัปเดต updated_at เมื่อมีการแก้ไขข้อมูล
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- สร้าง Trigger สำหรับแต่ละตาราง
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_destinations_updated_at
BEFORE UPDATE ON destinations
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_delivery_services_updated_at
BEFORE UPDATE ON delivery_services
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_freight_rates_updated_at
BEFORE UPDATE ON freight_rates
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_quotations_updated_at
BEFORE UPDATE ON quotations
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) Policies
-- เพิ่ม Policy เพื่อให้ user สามารถเข้าถึงข้อมูลของตัวเองได้เท่านั้น

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for each table
CREATE POLICY profiles_policy ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY companies_policy ON companies
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY destinations_policy ON destinations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY delivery_services_policy ON delivery_services
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY freight_rates_policy ON freight_rates
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY quotations_policy ON quotations
  FOR ALL USING (created_by = auth.uid() OR last_updated_by = auth.uid());

CREATE POLICY document_submissions_policy ON document_submissions
  FOR ALL USING (
    quotation_id IN (
      SELECT id FROM quotations WHERE created_by = auth.uid()
    )
  );

CREATE POLICY settings_policy ON settings
  FOR ALL USING (user_id = auth.uid());

-- เพิ่มฟังก์ชัน auto generated quotation number
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  sequence_number INT;
  new_quotation_no TEXT;
BEGIN
  -- รับปีปัจจุบัน
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- หาเลขลำดับล่าสุดสำหรับปีนี้
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_no FROM 8) AS INTEGER)), 0) + 1
  INTO sequence_number
  FROM quotations
  WHERE quotation_no LIKE 'QT-' || year_part || '-%';
  
  -- สร้างเลขที่ใบเสนอราคาใหม่
  new_quotation_no := 'QT-' || year_part || '-' || LPAD(sequence_number::TEXT, 4, '0');
  
  -- กำหนดค่าให้กับ NEW record
  NEW.quotation_no := new_quotation_no;
  
  -- คำนวณวันหมดอายุถ้ายังไม่ได้กำหนด
  IF NEW.expiry_date IS NULL AND NEW.validity_days IS NOT NULL THEN
    NEW.expiry_date := NEW.date + (NEW.validity_days * INTERVAL '1 day');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger ที่จะเรียกใช้ฟังก์ชันก่อนการเพิ่มข้อมูลใหม่
CREATE TRIGGER set_quotation_number
BEFORE INSERT ON quotations
FOR EACH ROW
WHEN (NEW.quotation_no IS NULL OR NEW.quotation_no = '')
EXECUTE FUNCTION generate_quotation_number(); 