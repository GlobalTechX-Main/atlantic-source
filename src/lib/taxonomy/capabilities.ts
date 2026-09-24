export interface TaxonomyCapability {
  id: string;
  canonicalName: string;
  slug: string;
  description?: string;
}

export interface TaxonomyAlias {
  alias: string;
  capabilityId: string;
  normalizedAlias: string;
}

export const TAXONOMY_CAPABILITIES: TaxonomyCapability[] = [
  { id: "cap_struct", canonicalName: "Structural Steel Fabrication", slug: "structural-steel-fabrication" },
  { id: "cap_custom", canonicalName: "Custom Metal Fabrication", slug: "custom-metal-fabrication" },
  { id: "cap_stain", canonicalName: "Stainless Steel Fabrication", slug: "stainless-steel-fabrication" },
  { id: "cap_weld", canonicalName: "Welding", slug: "welding" },
  { id: "cap_mach", canonicalName: "Machining", slug: "machining" },
  { id: "cap_pipe", canonicalName: "Pipe Fabrication", slug: "pipe-fabrication" },
  { id: "cap_elec", canonicalName: "Electrical Contracting", slug: "electrical-contracting" },
  { id: "cap_auto", canonicalName: "Industrial Automation & Controls", slug: "industrial-automation-controls" },
  { id: "cap_mill", canonicalName: "Millwrighting & Mechanical Maintenance", slug: "millwrighting-mechanical-maintenance" },
  { id: "cap_hvac", canonicalName: "Mechanical/HVAC", slug: "mechanical-hvac" },
  { id: "cap_press", canonicalName: "Pressure Vessels & Tank Fabrication", slug: "pressure-vessels-tank-fabrication" },
  { id: "cap_coat", canonicalName: "Protective Coatings & Industrial Painting", slug: "protective-coatings-industrial-painting" },
  { id: "cap_hydr", canonicalName: "Hydraulic Repair & Fluid Power", slug: "hydraulic-repair-fluid-power" },
  { id: "cap_ndt", canonicalName: "NDT & Industrial Inspection", slug: "ndt-industrial-inspection" },
  { id: "cap_civil", canonicalName: "Heavy Civil & Industrial Construction", slug: "heavy-civil-industrial-construction" },
];

export const TAXONOMY_ALIASES: TaxonomyAlias[] = [
  // Structural Steel
  { alias: "Structural Steel", capabilityId: "cap_struct", normalizedAlias: "structural steel" },
  { alias: "Steel Fabrication", capabilityId: "cap_struct", normalizedAlias: "steel fabrication" },
  { alias: "Building Frames", capabilityId: "cap_struct", normalizedAlias: "building frames" },
  { alias: "Bridge Steel", capabilityId: "cap_struct", normalizedAlias: "bridge steel" },
  { alias: "Heavy Steel", capabilityId: "cap_struct", normalizedAlias: "heavy steel" },

  // Custom Metal Fabrication
  { alias: "Metal Fabrication", capabilityId: "cap_custom", normalizedAlias: "metal fabrication" },
  { alias: "Custom Fabrication", capabilityId: "cap_custom", normalizedAlias: "custom fabrication" },
  { alias: "Custom Metalwork", capabilityId: "cap_custom", normalizedAlias: "custom metalwork" },
  { alias: "Sheet Metal Fabrication", capabilityId: "cap_custom", normalizedAlias: "sheet metal fabrication" },
  { alias: "Industrial Fabrication", capabilityId: "cap_custom", normalizedAlias: "industrial fabrication" },

  // Stainless Steel
  { alias: "Sanitary Stainless", capabilityId: "cap_stain", normalizedAlias: "sanitary stainless" },

  // Welding
  { alias: "TIG Welding", capabilityId: "cap_weld", normalizedAlias: "tig welding" },
  { alias: "MIG Welding", capabilityId: "cap_weld", normalizedAlias: "mig welding" },
  { alias: "CWB Certified Welding", capabilityId: "cap_weld", normalizedAlias: "cwb welding" },
  { alias: "Pressure Welding", capabilityId: "cap_weld", normalizedAlias: "pressure welding" },

  // Machining
  { alias: "CNC Machining", capabilityId: "cap_mach", normalizedAlias: "cnc machining" },
  { alias: "Precision Machining", capabilityId: "cap_mach", normalizedAlias: "precision machining" },
  { alias: "Machine Shop", capabilityId: "cap_mach", normalizedAlias: "machine shop" },
  { alias: "Grinding and Machining", capabilityId: "cap_mach", normalizedAlias: "grinding & machining" },
  { alias: "Grinding & Machining", capabilityId: "cap_mach", normalizedAlias: "grinding and machining" },

  // Electrical Contracting
  { alias: "Industrial Electrical", capabilityId: "cap_elec", normalizedAlias: "industrial electrical" },
  { alias: "Electrical Contractor", capabilityId: "cap_elec", normalizedAlias: "electrical contractor" },
  { alias: "Commercial Electrical", capabilityId: "cap_elec", normalizedAlias: "commercial electrical" },
  { alias: "Electrical Wiring", capabilityId: "cap_elec", normalizedAlias: "electrical wiring" },
  { alias: "Electric Services", capabilityId: "cap_elec", normalizedAlias: "electric services" },
  { alias: "Electrical Contracting", capabilityId: "cap_elec", normalizedAlias: "electrical contracting" },
  { alias: "High Voltage", capabilityId: "cap_elec", normalizedAlias: "high voltage" },

  // Industrial Automation & Controls
  { alias: "Industrial Automation", capabilityId: "cap_auto", normalizedAlias: "industrial automation" },
  { alias: "Control Panels", capabilityId: "cap_auto", normalizedAlias: "control panels" },
  { alias: "Control Panel", capabilityId: "cap_auto", normalizedAlias: "control panel" },
  { alias: "PLC Programming", capabilityId: "cap_auto", normalizedAlias: "plc programming" },
  { alias: "Automation Systems", capabilityId: "cap_auto", normalizedAlias: "automation systems" },
  { alias: "SCADA Systems", capabilityId: "cap_auto", normalizedAlias: "scada" },
  { alias: "Machine Automation", capabilityId: "cap_auto", normalizedAlias: "machine automation" },

  // Millwrighting & Maintenance
  { alias: "Millwrighting", capabilityId: "cap_mill", normalizedAlias: "millwrighting" },
  { alias: "Millwright", capabilityId: "cap_mill", normalizedAlias: "millwright" },
  { alias: "Machinery Installation", capabilityId: "cap_mill", normalizedAlias: "machinery installation" },
  { alias: "Equipment Installation", capabilityId: "cap_mill", normalizedAlias: "equipment installation" },
  { alias: "Shutdown Maintenance", capabilityId: "cap_mill", normalizedAlias: "shutdown maintenance" },
  { alias: "Mechanical Maintenance", capabilityId: "cap_mill", normalizedAlias: "mechanical maintenance" },

  // HVAC
  { alias: "Commercial HVAC", capabilityId: "cap_hvac", normalizedAlias: "commercial hvac" },
  { alias: "Industrial HVAC", capabilityId: "cap_hvac", normalizedAlias: "industrial hvac" },
  { alias: "Ventilation", capabilityId: "cap_hvac", normalizedAlias: "ventilation" },

  // Pressure Vessels & Tanks
  { alias: "Pressure Vessels", capabilityId: "cap_press", normalizedAlias: "pressure vessels" },
  { alias: "Pressure Vessel", capabilityId: "cap_press", normalizedAlias: "pressure vessel" },
  { alias: "Tank Fabrication", capabilityId: "cap_press", normalizedAlias: "tank fabrication" },

  // Protective Coatings
  { alias: "Protective Coatings", capabilityId: "cap_coat", normalizedAlias: "protective coatings" },
  { alias: "Industrial Coatings", capabilityId: "cap_coat", normalizedAlias: "industrial coatings" },
  { alias: "Hardchrome Plating", capabilityId: "cap_coat", normalizedAlias: "hardchrome" },
  { alias: "Chrome Plating", capabilityId: "cap_coat", normalizedAlias: "chrome plating" },
  { alias: "Industrial Painting", capabilityId: "cap_coat", normalizedAlias: "industrial painting" },

  // Hydraulics
  { alias: "Hydraulic Repair", capabilityId: "cap_hydr", normalizedAlias: "hydraulic repair" },
  { alias: "Hydraulics", capabilityId: "cap_hydr", normalizedAlias: "hydraulics" },
  { alias: "Fluid Power", capabilityId: "cap_hydr", normalizedAlias: "fluid power" },

  // Heavy Civil Construction
  { alias: "Heavy Civil Construction", capabilityId: "cap_civil", normalizedAlias: "heavy civil" },
  { alias: "Civil Engineering", capabilityId: "cap_civil", normalizedAlias: "civil engineering" },
  { alias: "Excavation", capabilityId: "cap_civil", normalizedAlias: "excavation" },
  { alias: "Site Preparation", capabilityId: "cap_civil", normalizedAlias: "site preparation" },
  { alias: "Quarry and Crushing", capabilityId: "cap_civil", normalizedAlias: "quarry and crushing" },
  { alias: "Drilling & Blasting", capabilityId: "cap_civil", normalizedAlias: "drilling & blasting" },

  // NDT
  { alias: "Non-Destructive Testing", capabilityId: "cap_ndt", normalizedAlias: "non-destructive testing" },
  { alias: "NDT Inspection", capabilityId: "cap_ndt", normalizedAlias: "ndt inspection" },
  { alias: "Ultrasonic Testing", capabilityId: "cap_ndt", normalizedAlias: "ultrasonic testing" },

  // Additional common wording found on Atlantic supplier sites
  { alias: "Mechanical Contractor", capabilityId: "cap_hvac", normalizedAlias: "mechanical contractor" },
  { alias: "Mechanical Contracting", capabilityId: "cap_hvac", normalizedAlias: "mechanical contracting" },
  { alias: "Powder Coating", capabilityId: "cap_coat", normalizedAlias: "powder coating" },
  { alias: "Steel Erection", capabilityId: "cap_struct", normalizedAlias: "steel erection" },
  { alias: "Pipe Fitting", capabilityId: "cap_pipe", normalizedAlias: "pipe fitting" },
  { alias: "Pipefitting", capabilityId: "cap_pipe", normalizedAlias: "pipefitting" },
  { alias: "Process Piping", capabilityId: "cap_pipe", normalizedAlias: "process piping" },
  { alias: "Electricians", capabilityId: "cap_elec", normalizedAlias: "electricians" },
  { alias: "HVAC", capabilityId: "cap_hvac", normalizedAlias: "hvac" },
  { alias: "NDT", capabilityId: "cap_ndt", normalizedAlias: "ndt" },
  { alias: "Sandblasting", capabilityId: "cap_coat", normalizedAlias: "sandblasting" },
];

/**
 * Aliases that were wrong and must never be used, even if they are still stored in the
 * database from an older seed. "Environmental Engineering" was mapped to NDT inspection.
 */
export const RETIRED_ALIASES = new Set<string>(["environmental engineering"]);
