/**
 * The demo seed's data: the 10 research centers, 11 demo accounts, 12 demo assets (one per status), and the lookup rows.
 * All invented or about institutions; nothing about real people.
 * Layer: database tooling. Read by prisma/seed.ts. Imports Prisma's enum types.
 * Used by: npm run seed.
 */
import type {
  asset_condition,
  assets_category,
  assets_status,
  research_centers_location,
  roles_role_name,
  users_account_status,
  users_user_type,
} from "@prisma/client";

/** One research center. Its short code is also the prefix of its asset tags. */
export interface DemoLab {
  name: string;
  shortCode: string;
  location: research_centers_location;
}

/** The 10 research centers, with the campuses decided for Batch 1. Names of institutions, not of people. */
export const DEMO_LABS: DemoLab[] = [
  { name: "Center for ICT for Development (CITE4D)", shortCode: "CITe4D", location: "MANILA" },
  { name: "Center for Automation Research (CAR)", shortCode: "CAR", location: "MANILA" },
  { name: "Center for Human-Computer Innovations (CeHCI)", shortCode: "CeHCI", location: "MANILA" },
  { name: "Human-X Interactions Lab", shortCode: "HXIL", location: "MCKINLEY" },
  { name: "Graphics, Animation, Multimedia and Entertainment Laboratory (GAME Lab)", shortCode: "GAME", location: "LAGUNA" },
  { name: "Center for Language Technologies (CeLT)", shortCode: "CeLT", location: "MANILA" },
  { name: "Bioinformatics Lab", shortCode: "Bio", location: "MANILA" },
  { name: "Center for Networking and Information Security (CNIS)", shortCode: "CNIS", location: "MANILA" },
  { name: "Computational Imaging and Visual Innovations (CIVI)", shortCode: "CIVI", location: "MANILA" },
  { name: "Technology, Education, Entertainment, Empathy, Design (TE3D) House", shortCode: "TE3D", location: "LAGUNA" },
];

/** One demo account. Every name is invented; the password is not here (SEED_PASSWORD, set when seeding). */
export interface DemoAccount {
  userId: number;
  lastName: string;
  email: string;
  /** The account's one role, or null for a sign-up that has none yet. */
  role: roles_role_name | null;
  userType: users_user_type;
  status: users_account_status;
  /** Short codes of the labs the account belongs to (user_centers). */
  labs: string[];
  /** Short code of the lab the account heads (research_centers.head_user_id), or null. */
  heads: string | null;
}

/**
 * The demo accounts. The Lab Heads are the labs' office accounts (Researcher role, set as the lab's Head).
 * Addresses are @dlsu.edu.ph because the login page accepts no other domain.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { userId: 1, lastName: "IT Admin", email: "demo.admin@dlsu.edu.ph", role: "IT_ADMIN", userType: "STAFF", status: "ACTIVE", labs: [], heads: null },
  { userId: 2, lastName: "Director", email: "demo.director@dlsu.edu.ph", role: "ADRIC_DIRECTOR", userType: "FACULTY", status: "ACTIVE", labs: [], heads: null },
  { userId: 3, lastName: "Secretary", email: "demo.secretary@dlsu.edu.ph", role: "ADRIC_SECRETARY", userType: "STAFF", status: "ACTIVE", labs: [], heads: null },
  { userId: 4, lastName: "TSG Staff A", email: "demo.tsg@dlsu.edu.ph", role: "TSG_STAFF", userType: "STAFF", status: "ACTIVE", labs: [], heads: null },
  { userId: 5, lastName: "TSG Staff B", email: "demo.tsg.b@dlsu.edu.ph", role: "TSG_STAFF", userType: "STAFF", status: "ACTIVE", labs: [], heads: null },
  { userId: 6, lastName: "Lab Head CITe4D", email: "demo.labhead.cite4d@dlsu.edu.ph", role: "RESEARCHER", userType: "FACULTY", status: "ACTIVE", labs: ["CITe4D"], heads: "CITe4D" },
  { userId: 7, lastName: "Lab Head CAR", email: "demo.labhead.car@dlsu.edu.ph", role: "RESEARCHER", userType: "FACULTY", status: "ACTIVE", labs: ["CAR"], heads: "CAR" },
  { userId: 8, lastName: "Researcher A", email: "demo.researcher.a@dlsu.edu.ph", role: "RESEARCHER", userType: "STUDENT", status: "ACTIVE", labs: ["CITe4D"], heads: null },
  { userId: 9, lastName: "Researcher B", email: "demo.researcher.b@dlsu.edu.ph", role: "RESEARCHER", userType: "FACULTY", status: "ACTIVE", labs: ["CITe4D", "CAR"], heads: null },
  { userId: 10, lastName: "Researcher C", email: "demo.researcher.c@dlsu.edu.ph", role: "RESEARCHER", userType: "STUDENT", status: "ACTIVE", labs: ["HXIL"], heads: null },
  { userId: 11, lastName: "Pending Applicant", email: "demo.pending@dlsu.edu.ph", role: null, userType: "STUDENT", status: "PENDING", labs: ["CeLT"], heads: null },
];

/** The borrower of the demo asset that is on loan. */
export const DEMO_BORROWER_ID = 8;

/** The TSG account that files the demo inspections and requests the demo retirements. */
export const DEMO_TSG_ID = 4;

/** One demo asset. Its lab is its tag's prefix. */
export interface DemoAsset {
  tag: string;
  name: string;
  serial: string;
  manufacturer: string;
  category: assets_category;
  procured: string;
  warranty: string;
  funding: string;
  value: number;
  homeRoom: string;
  status: assets_status;
  condition: asset_condition;
  accessories?: string;
}

/** 12 demo assets in 4 labs, with one of each status. Product names and invented serial numbers. */
export const DEMO_ASSETS: DemoAsset[] = [
  { tag: "CITe4D-0001", name: "ASUS TUF Gaming A15", serial: "SN-TUFN1G401", manufacturer: "ASUS", category: "CPU", procured: "2025-08-10", warranty: "2027-08-10", funding: "DOST-SEI", value: 49999, homeRoom: "G406", status: "AVAILABLE", condition: "PERFECT", accessories: "charger, mouse" },
  { tag: "CITe4D-0002", name: "Meta Quest 3", serial: "SN-MQ3-0091", manufacturer: "Meta", category: "VR", procured: "2026-01-15", warranty: "2027-01-15", funding: "DOST-PCIEERD", value: 35000, homeRoom: "G406", status: "ON_LOAN", condition: "OPERATIONAL" },
  { tag: "CITe4D-0003", name: "Raspberry Pi 5 Kit", serial: "SN-RPI5-0036", manufacturer: "Raspberry Pi Foundation", category: "DEV_KIT", procured: "2026-03-01", warranty: "2028-03-01", funding: "DOST-SEI", value: 3499, homeRoom: "G408", status: "AVAILABLE", condition: "PERFECT" },
  { tag: "CITe4D-0004", name: "Canon EOS 90D", serial: "SN-CN90D-77", manufacturer: "Canon", category: "CAMERA", procured: "2025-07-20", warranty: "2027-07-20", funding: "CHED", value: 89999, homeRoom: "G408", status: "MISSING", condition: "OPERATIONAL" },
  { tag: "CAR-0001", name: "Robotics Arm Simulator Kit", serial: "SN-RASK-104", manufacturer: "Universal Robots", category: "SIMULATOR", procured: "2025-05-12", warranty: "2027-05-12", funding: "DOST-SEI", value: 65000, homeRoom: "V302", status: "AVAILABLE", condition: "PERFECT" },
  { tag: "CAR-0002", name: "Samsung T7 Portable SSD 1TB", serial: "SN-SMT7SSD-047", manufacturer: "Samsung", category: "HARD_DRIVE", procured: "2025-11-05", warranty: "2028-11-05", funding: "CHED", value: 8999, homeRoom: "V302", status: "MAINTENANCE", condition: "DEGRADED" },
  { tag: "CAR-0003", name: "TP-Link Archer AX55 Router", serial: "SN-TPAX55-210", manufacturer: "TP-Link", category: "ROUTER", procured: "2025-09-15", warranty: "2027-09-15", funding: "CHED", value: 4999, homeRoom: "V304", status: "AVAILABLE", condition: "OPERATIONAL" },
  { tag: "HXIL-0001", name: "Apple iPad Air", serial: "SN-IPADAIR-301", manufacturer: "Apple", category: "TABLET", procured: "2025-10-01", warranty: "2026-10-01", funding: "DOST-PCIEERD", value: 39990, homeRoom: "M201", status: "AVAILABLE", condition: "PERFECT" },
  { tag: "HXIL-0002", name: "Dell UltraSharp 27 Monitor", serial: "SN-DELLU27X", manufacturer: "Dell", category: "MONITOR", procured: "2023-08-10", warranty: "2025-08-10", funding: "DOST-SEI", value: 18500, homeRoom: "M201", status: "PENDING_RETIREMENT", condition: "CRITICAL_DEFECT" },
  { tag: "HXIL-0003", name: "Logitech C920 Webcam", serial: "SN-LGC920-046", manufacturer: "Logitech", category: "CAMERA", procured: "2025-11-05", warranty: "2027-11-05", funding: "DOST-SEI", value: 6999, homeRoom: "M203", status: "AVAILABLE", condition: "OPERATIONAL" },
  { tag: "TE3D-0001", name: "Anker PowerConf S500 Speakerphone", serial: "SN-ANKPC-049", manufacturer: "Anker", category: "AUDIO", procured: "2025-12-01", warranty: "2027-12-01", funding: "CHED", value: 12999, homeRoom: "L105", status: "AVAILABLE", condition: "PERFECT" },
  { tag: "TE3D-0002", name: "Epson EB-X51 Projector", serial: "SN-EPSX51-512", manufacturer: "Epson", category: "PROJECTOR", procured: "2021-06-01", warranty: "2023-06-01", funding: "Internal Grants", value: 27500, homeRoom: "L105", status: "RETIRED", condition: "CRITICAL_DEFECT" },
];

/** The funding sources, as the migrations write them. The seed writes any that are missing. */
export const DEMO_FUNDING_SOURCES = ["DOST", "USAID", "CHED", "Internal Grants", "DOST-PCIEERD", "DOST-SEI", "Personal (self-funded)"];

/** The issue types, as the foundation migration writes them: key, name, suggested first action. */
export const DEMO_ISSUE_TYPES: [string, string, string][] = [
  ["WONT_POWER_ON", "Won't power on", "Check the charger, the cable and the outlet, then try another outlet."],
  ["BATTERY_CHARGING", "Battery or charging", "Try another charger and note how long the battery lasts."],
  ["DISPLAY", "Display", "Check the cable and the brightness, and note any lines, spots or flicker."],
  ["STORAGE_DATA", "Storage or data", "Stop saving files to the device and write down any error message."],
  ["NETWORK_PORTS", "Network or ports", "Try another cable or port and note which ports fail."],
  ["PHYSICAL_DAMAGE", "Physical damage", "Stop using the device and take a photo of the damage."],
  ["ACCESSORY_MISSING", "Accessory missing", "List the missing items and when they were last seen."],
  ["SOFTWARE_OS", "Software or OS", "Restart the device and write down the exact error message."],
  ["OTHER", "Other", "Describe what happens and when it started."],
];

/** The metric definitions, as the foundation migration writes them: key, name, unit, higher is better. */
export const DEMO_METRICS: [string, string, string, boolean][] = [
  ["CPU_LOAD_TEMP", "CPU load temperature", "°C", false],
  ["BAD_SECTORS", "Bad sectors", "count", false],
  ["BATTERY_CAPACITY", "Battery capacity", "% of design", true],
  ["READ_SPEED", "Read speed", "MB/s", true],
  ["WORKING_PORTS", "Working ports", "count", true],
  ["PACKET_LOSS", "Packet loss", "%", false],
  ["SENSOR_DRIFT", "Sensor drift", "%", false],
  ["MOTOR_SPEED", "Motor speed", "RPM", true],
];

/** Which metrics each category records (manuscript 1.6.2.2.3), as the foundation migration writes them. */
export const DEMO_CATEGORY_METRICS: [assets_category, string][] = [
  ["CPU", "CPU_LOAD_TEMP"], ["CPU", "BAD_SECTORS"], ["CPU", "BATTERY_CAPACITY"],
  ["TABLET", "BATTERY_CAPACITY"], ["VR", "BATTERY_CAPACITY"],
  ["HARD_DRIVE", "BAD_SECTORS"], ["HARD_DRIVE", "READ_SPEED"],
  ["MEMORY_CARD", "BAD_SECTORS"], ["MEMORY_CARD", "READ_SPEED"],
  ["ROUTER", "WORKING_PORTS"], ["ROUTER", "PACKET_LOSS"],
  ["SWITCH", "WORKING_PORTS"], ["SWITCH", "PACKET_LOSS"],
  ["DEV_KIT", "SENSOR_DRIFT"], ["DEV_KIT", "MOTOR_SPEED"],
  ["SIMULATOR", "SENSOR_DRIFT"], ["SIMULATOR", "MOTOR_SPEED"],
];
