/**
 * Example companies for the landing-page preview. They are invented (the same sample set
 * used in the product guide) so the preview never misrepresents a real supplier.
 */
export interface SampleSupplier {
  name: string;
  city: string;
  province: string;
  summary: string;
  capabilities: string[];
  certifications: string[];
  /** Words the preview search matches on, besides the fields above. */
  services: string[];
  contact: "High" | "Medium";
  checkedDaysAgo: number;
  claimed: boolean;
}

export const SAMPLE_SUPPLIERS: SampleSupplier[] = [
  {
    name: "Harbourline Fabrication Ltd.",
    city: "Moncton",
    province: "NB",
    summary: "Structural and miscellaneous steel for commercial and industrial projects.",
    capabilities: ["Structural Steel", "Fabrication", "Welding"],
    certifications: ["CWB W47.1", "ISO 9001", "COR"],
    services: ["stairs", "railings", "shop drawings", "erection", "mobile welding"],
    contact: "High",
    checkedDaysAgo: 2,
    claimed: true,
  },
  {
    name: "Fundy Hydraulic & Fluid Power",
    city: "Saint John",
    province: "NB",
    summary: "Cylinder repair, hose assemblies and marine hydraulics. 24/7 service line.",
    capabilities: ["Hydraulic Repair", "Machining"],
    certifications: ["ISO 9001"],
    services: ["cylinder", "pump", "hose", "marine"],
    contact: "High",
    checkedDaysAgo: 5,
    claimed: false,
  },
  {
    name: "Kennebec NDT Services",
    city: "Saint John",
    province: "NB",
    summary: "Ultrasonic, radiography, magnetic particle and weld inspection.",
    capabilities: ["NDT Inspection"],
    certifications: ["CGSB technicians"],
    services: ["ultrasonic", "radiography", "weld inspection", "tank inspection", "ndt"],
    contact: "Medium",
    checkedDaysAgo: 9,
    claimed: false,
  },
  {
    name: "Northshore Machine Works",
    city: "Bathurst",
    province: "NB",
    summary: "CNC machining and millwright services for mills and plants.",
    capabilities: ["Machining", "Millwrighting"],
    certifications: [],
    services: ["cnc", "shaft repair", "gearbox", "laser alignment"],
    contact: "Medium",
    checkedDaysAgo: 14,
    claimed: false,
  },
  {
    name: "Petitcodiac Stainless",
    city: "Moncton",
    province: "NB",
    summary: "Sanitary stainless fabrication for food and beverage plants.",
    capabilities: ["Stainless Fabrication", "Fabrication", "Welding"],
    certifications: [],
    services: ["orbital welding", "tanks", "conveyors", "process piping"],
    contact: "High",
    checkedDaysAgo: 3,
    claimed: false,
  },
  {
    name: "Chignecto Pipe & Mechanical",
    city: "Halifax",
    province: "NS",
    summary: "Process piping, HVAC and pressure vessels for industrial clients.",
    capabilities: ["Pipe Fabrication", "Mechanical / HVAC", "Welding"],
    certifications: ["ASME VIII", "CWB W47.1"],
    services: ["boiler", "pressure vessel", "plumbing", "hvac"],
    contact: "High",
    checkedDaysAgo: 6,
    claimed: false,
  },
  {
    name: "Riverbend Electrical Contractors",
    city: "Fredericton",
    province: "NB",
    summary: "Industrial electrical, PLC programming and motor control centres.",
    capabilities: ["Electrical", "Automation & Controls"],
    certifications: ["COR"],
    services: ["plc", "generator", "thermographic", "mcc"],
    contact: "High",
    checkedDaysAgo: 4,
    claimed: false,
  },
  {
    name: "Tidewater Coatings Inc.",
    city: "Dieppe",
    province: "NB",
    summary: "Blasting, industrial coatings and tank linings.",
    capabilities: ["Industrial Coatings"],
    certifications: ["SSPC QP1"],
    services: ["sandblasting", "fireproofing", "tank linings", "painting"],
    contact: "Medium",
    checkedDaysAgo: 11,
    claimed: false,
  },
];

/** Towns the preview treats as part of each city, as the real directory does. */
export const PREVIEW_CITIES: Record<string, string[]> = {
  Moncton: ["Moncton", "Dieppe", "Riverview"],
  "Saint John": ["Saint John"],
  Fredericton: ["Fredericton"],
  Halifax: ["Halifax", "Dartmouth"],
  Bathurst: ["Bathurst"],
};
