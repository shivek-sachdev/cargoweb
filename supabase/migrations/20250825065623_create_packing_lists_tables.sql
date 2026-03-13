-- สร้างตาราง packing_lists สำหรับเก็บข้อมูล Packing List
DROP TABLE IF EXISTS packing_list_products CASCADE;
DROP TABLE IF EXISTS packing_list_pallets CASCADE;
DROP TABLE IF EXISTS packing_lists CASCADE;

CREATE TABLE packing_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  packing_list_no TEXT UNIQUE, -- เลขที่ Packing List (auto-generated)
  
  -- Header Information (Consignee)
  consignee TEXT NOT NULL,
  consignee_address TEXT,
  consignee_phone TEXT,
  consignee_email TEXT,
  consignee_contract TEXT,
  
  -- Consigner Information
  consigner TEXT NOT NULL,
  consigner_address TEXT,
  consigner_phone TEXT,
  consigner_email TEXT,
  consigner_contract TEXT,
  
  -- Shipped To Information
  shipped_to TEXT,
  shipped_to_address TEXT,
  shipped_to_phone TEXT,
  shipped_to_email TEXT,
  shipped_to_contract TEXT,
  
  -- Shipping Details
  customer_op_no TEXT,
  type_of_shipment TEXT,
  port_loading TEXT,
  port_destination TEXT,
  
  -- Summary Information
  total_gross_weight DECIMAL(12, 2), -- น้ำหนักรวมทั้งหมด (กรัม)
  box_size TEXT,
  shipping_mark TEXT,
  airport TEXT,
  destination TEXT,
  country_of_origin TEXT DEFAULT 'Thailand',
  
  -- Status and Metadata
  status TEXT DEFAULT 'draft', -- draft, completed, archived
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- สร้างตาราง packing_list_pallets สำหรับเก็บข้อมูล Pallets
CREATE TABLE packing_list_pallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  packing_list_id UUID REFERENCES packing_lists(id) ON DELETE CASCADE,
  pallet_number INTEGER NOT NULL, -- หมายเลข pallet (1, 2, 3, ...)
  box_number_from INTEGER NOT NULL,
  box_number_to INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- สร้างตาราง packing_list_products สำหรับเก็บข้อมูลสินค้าในแต่ละ Pallet
CREATE TABLE packing_list_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pallet_id UUID REFERENCES packing_list_pallets(id) ON DELETE CASCADE,
  
  -- Product Information
  product_code TEXT,
  description TEXT,
  batch TEXT,
  quantity INTEGER NOT NULL, -- จำนวนกล่อง
  weight_per_box DECIMAL(10, 2) NOT NULL, -- น้ำหนักต่อกล่อง (กรัม)
  total_gross_weight DECIMAL(12, 2) NOT NULL, -- น้ำหนักรวม gross (กรัม)
  
  -- Mixed Product Support
  has_mixed_products BOOLEAN DEFAULT FALSE,
  second_product_code TEXT,
  second_description TEXT,
  second_batch TEXT,
  second_weight_per_box DECIMAL(10, 2),
  second_total_gross_weight DECIMAL(12, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- สร้างฟังก์ชัน auto generate packing list number
CREATE OR REPLACE FUNCTION generate_packing_list_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  sequence_number INT;
  new_packing_list_no TEXT;
BEGIN
  -- รับปีปัจจุบัน
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- หาเลขลำดับล่าสุดสำหรับปีนี้
  SELECT COALESCE(MAX(CAST(SUBSTRING(packing_list_no FROM 8) AS INTEGER)), 0) + 1
  INTO sequence_number
  FROM packing_lists
  WHERE packing_list_no LIKE 'PL-' || year_part || '-%';
  
  -- สร้างเลขที่ Packing List ใหม่
  new_packing_list_no := 'PL-' || year_part || '-' || LPAD(sequence_number::TEXT, 4, '0');
  
  -- กำหนดค่าให้กับ NEW record
  NEW.packing_list_no := new_packing_list_no;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง trigger สำหรับ auto generate packing list number
CREATE TRIGGER set_packing_list_number
BEFORE INSERT ON packing_lists
FOR EACH ROW
WHEN (NEW.packing_list_no IS NULL OR NEW.packing_list_no = '')
EXECUTE FUNCTION generate_packing_list_number();

-- สร้างฟังก์ชันกลางสำหรับการอัพเดต updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- สร้าง trigger สำหรับ updated_at
CREATE TRIGGER update_packing_lists_updated_at
BEFORE UPDATE ON packing_lists
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_list_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY packing_lists_policy ON packing_lists
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY packing_list_pallets_policy ON packing_list_pallets
  FOR ALL USING (
    packing_list_id IN (
      SELECT id FROM packing_lists WHERE created_by = auth.uid()
    )
  );

CREATE POLICY packing_list_products_policy ON packing_list_products
  FOR ALL USING (
    pallet_id IN (
      SELECT p.id FROM packing_list_pallets p
      JOIN packing_lists pl ON p.packing_list_id = pl.id
      WHERE pl.created_by = auth.uid()
    )
  );

-- สร้าง index สำหรับ performance
CREATE INDEX idx_packing_lists_created_by ON packing_lists(created_by);
CREATE INDEX idx_packing_lists_status ON packing_lists(status);
CREATE INDEX idx_packing_lists_created_at ON packing_lists(created_at DESC);
CREATE INDEX idx_packing_list_pallets_packing_list_id ON packing_list_pallets(packing_list_id);
CREATE INDEX idx_packing_list_products_pallet_id ON packing_list_products(pallet_id);
