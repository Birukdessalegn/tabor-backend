-- Tabor Hotel Database Schema
-- Standalone Room Reservation & Front Desk System

-- Users table (admin, receptionist, supervisor)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'receptionist', 'supervisor')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Room types table
CREATE TABLE IF NOT EXISTS room_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_occupancy INTEGER DEFAULT 2,
  amenities TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  room_number VARCHAR(20) UNIQUE NOT NULL,
  floor INTEGER DEFAULT 1,
  room_type_id INTEGER REFERENCES room_types(id),
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved', 'cleaning')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  nationality VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Room reservations table
CREATE TABLE IF NOT EXISTS room_reservations (
  id SERIAL PRIMARY KEY,
  reservation_code VARCHAR(50) UNIQUE,
  room_id INTEGER REFERENCES rooms(id),
  customer_id INTEGER REFERENCES customers(id),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  actual_check_in TIMESTAMP,
  actual_check_out TIMESTAMP,
  nights INTEGER,
  rate_per_night NUMERIC(12,2) NOT NULL,
  original_rate_per_night NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  amended_total NUMERIC(12,2),
  amendment_reason TEXT,
  amended_by INTEGER REFERENCES users(id),
  amended_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  special_requests TEXT,
  notes TEXT,
  id_image_url TEXT,
  id_image_front_url TEXT,
  id_image_back_url TEXT,
  transaction_reference VARCHAR(100),
  receipt_image TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Room payments table
CREATE TABLE IF NOT EXISTS room_payments (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER REFERENCES room_reservations(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_money', 'complimentary')),
  payment_date TIMESTAMP DEFAULT NOW(),
  reference_number VARCHAR(100),
  notes TEXT,
  receipt_image TEXT,
  received_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_reservations_room_id ON room_reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_reservations_customer_id ON room_reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_room_reservations_status ON room_reservations(status);
CREATE INDEX IF NOT EXISTS idx_room_reservations_check_in ON room_reservations(check_in_date);
CREATE INDEX IF NOT EXISTS idx_room_payments_reservation_id ON room_payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
