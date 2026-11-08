/**
 * The demo seed's data: the 10 research centers, 30 demo accounts, 7 projects, 58 demo assets, and the lookup rows.
 * All invented or about institutions; the personal names are from the pre-UAT dummy data, never real people.
 * Layer: database tooling. Read by prisma/seed.ts, seedHistory.ts, seedSteps.ts and seedStory.ts. Imports Prisma's enum types.
 * Used by: npm run seed.
 */
import type {
  asset_condition,
  assets_category,
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

/**
 * One demo account, as it is on the day the seed runs, with the account steps the IT Admin took on it. Days count back
 * from that day. The password is not here (SEED_PASSWORD, set when seeding).
 */
export interface DemoAccount {
  userId: number;
  firstName: string;
  lastName: string;
  /** The sign-up email. An anonymized account is written with the placeholder anonymizeUser leaves instead. */
  email: string;
  /** The account's one role now, or null for a sign-up that has none. */
  role: roles_role_name | null;
  userType: users_user_type;
  status: users_account_status;
  /** Short codes of the labs the account belongs to now (user_centers); for an anonymized account, the labs it had. */
  labs: string[];
  /** Short code of the lab the account heads (research_centers.head_user_id), or null. */
  heads: string | null;
  /** Days ago the IT Admin approved or rejected the sign-up; null when nobody did (the first IT Admin, a Pending one). */
  decidedDaysAgo: number | null;
  /** The role it was approved with, when the IT Admin changed it later (ROLE_CHANGED). */
  approvedAs?: roles_role_name;
  /** Days ago the role changed to `role`. */
  roleChangedDaysAgo?: number;
  /** The labs it was approved with, when the IT Admin changed them later (LABS_CHANGED). */
  approvedLabs?: string[];
  /** Days ago the labs changed to `labs`. */
  labsChangedDaysAgo?: number;
  /** Days ago the IT Admin set it as Head of `heads` (HEAD_CHANGED). */
  headSinceDaysAgo?: number;
  /** Days ago the IT Admin deactivated it. */
  deactivatedDaysAgo?: number;
  /** Days ago the IT Admin anonymized it. Its labs are gone and it is written as "Former researcher". */
  anonymizedDaysAgo?: number;
  /** The IT Admin's remarks on a rejected sign-up (the SIGNUP_REJECTED row's details). */
  rejectRemarks?: string;
}

/** Lab Head office account for a lab: a Researcher, member and Head of that lab since the IT Admin approved it. */
function labHead(userId: number, code: string, decidedDaysAgo: number): DemoAccount {
  return {
    userId, firstName: "Demo", lastName: `Lab Head ${code}`, email: `demo.labhead.${code.toLowerCase()}@dlsu.edu.ph`,
    role: "RESEARCHER", userType: "FACULTY", status: "ACTIVE", labs: [code], heads: code,
    decidedDaysAgo, headSinceDaysAgo: decidedDaysAgo,
  };
}

/** A personal Researcher account. */
function researcher(userId: number, letter: string, firstName: string, lastName: string, userType: users_user_type, labs: string[], decidedDaysAgo: number): DemoAccount {
  return {
    userId, firstName, lastName, email: `demo.researcher.${letter}@dlsu.edu.ph`,
    role: "RESEARCHER", userType, status: "ACTIVE", labs, heads: null, decidedDaysAgo,
  };
}

/**
 * The demo accounts. The Lab Heads are the labs' office accounts (Researcher role, set as the lab's Head). Accounts 1 to
 * 11 keep the emails, roles, labs and Heads the manuals and smoke tests use. Personal names from 20 on come from the
 * pre-UAT dummy data. Addresses are @dlsu.edu.ph because the login page accepts no other domain.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { userId: 1, firstName: "Demo", lastName: "IT Admin", email: "demo.admin@dlsu.edu.ph", role: "IT_ADMIN", userType: "STAFF", status: "ACTIVE", labs: [], heads: null, decidedDaysAgo: null },
  { userId: 2, firstName: "Demo", lastName: "Director", email: "demo.director@dlsu.edu.ph", role: "ADRIC_DIRECTOR", userType: "FACULTY", status: "ACTIVE", labs: [], heads: null, decidedDaysAgo: 196 },
  {
    userId: 3, firstName: "Demo", lastName: "Secretary", email: "demo.secretary@dlsu.edu.ph", role: "ADRIC_SECRETARY", userType: "STAFF", status: "ACTIVE", labs: [], heads: null,
    decidedDaysAgo: 196, approvedAs: "TSG_STAFF", roleChangedDaysAgo: 195,
  },
  { userId: 4, firstName: "Demo", lastName: "TSG Staff A", email: "demo.tsg@dlsu.edu.ph", role: "TSG_STAFF", userType: "STAFF", status: "ACTIVE", labs: [], heads: null, decidedDaysAgo: 196 },
  { userId: 5, firstName: "Demo", lastName: "TSG Staff B", email: "demo.tsg.b@dlsu.edu.ph", role: "TSG_STAFF", userType: "STAFF", status: "ACTIVE", labs: [], heads: null, decidedDaysAgo: 196 },
  labHead(6, "CITe4D", 195),
  labHead(7, "CAR", 195),
  { userId: 8, firstName: "Demo", lastName: "Researcher A", email: "demo.researcher.a@dlsu.edu.ph", role: "RESEARCHER", userType: "STUDENT", status: "ACTIVE", labs: ["CITe4D"], heads: null, decidedDaysAgo: 192 },
  { userId: 9, firstName: "Demo", lastName: "Researcher B", email: "demo.researcher.b@dlsu.edu.ph", role: "RESEARCHER", userType: "FACULTY", status: "ACTIVE", labs: ["CITe4D", "CAR"], heads: null, decidedDaysAgo: 192 },
  { userId: 10, firstName: "Demo", lastName: "Researcher C", email: "demo.researcher.c@dlsu.edu.ph", role: "RESEARCHER", userType: "STUDENT", status: "ACTIVE", labs: ["HXIL"], heads: null, decidedDaysAgo: 191 },
  { userId: 11, firstName: "Demo", lastName: "Pending Applicant", email: "demo.pending@dlsu.edu.ph", role: null, userType: "STUDENT", status: "PENDING", labs: ["CeLT"], heads: null, decidedDaysAgo: null },
  labHead(12, "CeHCI", 195),
  labHead(13, "HXIL", 195),
  labHead(14, "GAME", 194),
  labHead(15, "CeLT", 194),
  labHead(16, "Bio", 71),
  labHead(17, "CNIS", 194),
  labHead(18, "CIVI", 194),
  labHead(19, "TE3D", 194),
  researcher(20, "d", "Maria", "Santos", "FACULTY", ["CeHCI", "CeLT"], 191),
  researcher(21, "e", "Carlos", "Reyes", "STUDENT", ["CNIS"], 190),
  researcher(22, "f", "Lorenzo", "Celis", "STUDENT", ["GAME"], 190),
  researcher(23, "g", "Hannah", "Cruz", "FACULTY", ["GAME", "TE3D"], 189),
  researcher(24, "h", "Nicolas", "Sy", "STUDENT", ["CIVI"], 122),
  researcher(25, "i", "Victor", "Ibarra", "STUDENT", ["HXIL"], 150),
  researcher(26, "j", "Grace", "Alcantara", "STUDENT", ["TE3D"], 131),
  { ...researcher(27, "k", "Teresa", "Diaz", "FACULTY", ["Bio", "CIVI"], 96), approvedLabs: ["CIVI"], labsChangedDaysAgo: 68 },
  { ...researcher(28, "l", "Felix", "Torres", "STUDENT", ["CAR"], 189), status: "INACTIVE", deactivatedDaysAgo: 35 },
  { ...researcher(29, "m", "Arthur", "Pendleton", "STUDENT", ["GAME"], 189), status: "INACTIVE", deactivatedDaysAgo: 84, anonymizedDaysAgo: 60 },
  {
    userId: 30, firstName: "Demo", lastName: "Rejected Applicant", email: "demo.rejected@dlsu.edu.ph", role: null, userType: "STUDENT", status: "REJECTED",
    labs: [], heads: null, decidedDaysAgo: 21, rejectRemarks: "Not yet a member of an AdRIC lab. Sign up again once your adviser adds you to one.",
  },
];

/** The first IT Admin, who approves, rejects and changes every other account. */
export const DEMO_IT_ADMIN_ID = 1;

/** The two TSG accounts, who register, inspect, release and receive. */
export const DEMO_TSG_IDS = [4, 5] as const;

/** Each lab's home room for its assets: the rooms TSG's Excel names (CeLT, CeHCI, CNIS, HXIL, GAME), invented for the rest. */
export const DEMO_LAB_ROOMS: Record<string, string> = {
  CITe4D: "G407", CAR: "G408", CeHCI: "G402", HXIL: "G406", GAME: "G411",
  CeLT: "G409", Bio: "G401", CNIS: "G403", CIVI: "G405", TE3D: "G410",
};

/** One research project. Its leader is the display name of its lab's Head office account. */
export interface DemoProject {
  code: string;
  name: string;
  lab: string;
  funding: string;
  start: string;
  end: string;
}

/** 7 invented projects over 7 labs. */
export const DEMO_PROJECTS: DemoProject[] = [
  { code: "CITE4D-2024-01", name: "Community Telehealth Kiosks for Rural Health Units", lab: "CITe4D", funding: "DOST-PCIEERD", start: "2024-01-15", end: "2026-12-31" },
  { code: "CAR-2024-03", name: "Vision-Guided Sorting Arm for Recyclables", lab: "CAR", funding: "DOST-PCIEERD", start: "2024-03-01", end: "2027-02-28" },
  { code: "GAME-2023-02", name: "Serious Games for Disaster Preparedness", lab: "GAME", funding: "CHED", start: "2023-02-01", end: "2026-06-30" },
  { code: "HXIL-2023-05", name: "Driving Simulator Study on Driver Fatigue", lab: "HXIL", funding: "DOST-SEI", start: "2023-06-01", end: "2027-05-31" },
  { code: "CNIS-2024-02", name: "IoT Air Quality Sensor Network", lab: "CNIS", funding: "DOST", start: "2024-05-01", end: "2026-12-31" },
  { code: "TE3D-2024-01", name: "Empathy Through Play: Media Workshops for Youth", lab: "TE3D", funding: "Internal Grants", start: "2024-01-08", end: "2027-01-31" },
  { code: "CEHCI-2024-04", name: "Affective Computing for Online Learners", lab: "CeHCI", funding: "DOST-SEI", start: "2024-08-01", end: "2027-07-31" },
];

/**
 * One demo asset, as TSG registered it. Its lab is its tag's prefix, its home room the lab's room. Its status comes from
 * its history (seedHistory.ts).
 */
export interface DemoAsset {
  tag: string;
  name: string;
  manufacturer: string;
  category: assets_category;
  serial: string;
  /** The purchase date from TSG's Excel, or August of the academic year when the sheet has none. */
  procured: string;
  /**
   * The warranty's last day, or a number of days after the day the seed runs, for the three assets whose warranty must
   * end soon on any seed day (WAR-01). Those dates still fall 1 to 3 years after purchase.
   */
  warranty: string | { daysFromSeed: number };
  value: number;
  funding: string;
  /** The project's code, when the asset belongs to one. */
  project?: string;
  /** An invented ITS property tag, in the Excel's format (3 digits, a dash, 6 digits). */
  its?: string;
  accessories?: string;
  /** The condition TSG found at registration. It stays the same unless the history changes it. */
  condition: asset_condition;
  /** The metric values TSG recorded at registration, by metric key, for a category that has metrics. */
  metrics?: Record<string, number>;
  /** Days ago TSG registered it. */
  registeredDaysAgo: number;
  /** The file name, without ".jpg", of its photo in SEED_PHOTOS_DIR; the model name's photoKeyOf when left out. */
  photo?: string;
}

/** Desktop workstation metrics: CPU temperature under load and bad sectors. */
const TOWER = (temp: number, badSectors = 0) => ({ CPU_LOAD_TEMP: temp, BAD_SECTORS: badSectors });

/**
 * 58 assets in all 10 labs, with the models and purchase dates of TSG's Excel (COMET is HXIL, GameLab is GAME). Bio has
 * no sheet: it has ADRIC dev kits and a workstation. CAR, CIVI, CeHCI, CeLT and HXIL also take models from the ADRIC,
 * RL208, SJ212 and CCS Capex sheets. Serial numbers, values and ITS property tags are invented.
 */
export const DEMO_ASSETS: DemoAsset[] = [
  { tag: "CITe4D-0001", name: "Xiaomi Mi 360 Home Security Camera 2K", manufacturer: "Xiaomi", category: "CAMERA", serial: "MJSXJ09CM-21840731", procured: "2022-09-09", warranty: "2023-09-09", value: 2490, funding: "DOST-PCIEERD", project: "CITE4D-2024-01", its: "214-004517", accessories: "power adapter, wall mount", condition: "OPERATIONAL", registeredDaysAgo: 186 },
  { tag: "CITe4D-0002", name: "Xiaomi Mi 360 Home Security Camera 2K", manufacturer: "Xiaomi", category: "CAMERA", serial: "MJSXJ09CM-21840762", procured: "2022-09-09", warranty: "2023-09-09", value: 2490, funding: "DOST-PCIEERD", project: "CITE4D-2024-01", accessories: "power adapter, wall mount", condition: "OPERATIONAL", registeredDaysAgo: 186 },
  { tag: "CITe4D-0003", name: "SanDisk Ultra 32GB microSD Card", manufacturer: "SanDisk", category: "MEMORY_CARD", serial: "SDSQUA4-032G-7731", procured: "2022-09-09", warranty: "2025-09-09", value: 450, funding: "DOST-PCIEERD", its: "214-004518", condition: "OPERATIONAL", metrics: { BAD_SECTORS: 0, READ_SPEED: 98 }, registeredDaysAgo: 186 },
  { tag: "CITe4D-0004", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ221", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", its: "214-003902", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 186 },
  { tag: "CITe4D-0005", name: "Epson EB-X51 Projector", manufacturer: "Epson", category: "PROJECTOR", serial: "X8KF3301274", procured: "2023-03-13", warranty: "2025-03-13", value: 27500, funding: "Internal Grants", accessories: "remote control, power cable, HDMI cable, carrying case", condition: "OPERATIONAL", registeredDaysAgo: 186 },
  { tag: "CITe4D-0006", name: "Sony ICD-UX570 Voice Recorder", manufacturer: "Sony", category: "RECORDER", serial: "ICDUX570-4417093", procured: "2023-02-20", warranty: "2024-02-20", value: 5990, funding: "DOST-PCIEERD", project: "CITE4D-2024-01", its: "214-004691", accessories: "USB cable, pouch", condition: "OPERATIONAL", registeredDaysAgo: 186 },
  { tag: "CITe4D-0007", name: "Canon PowerShot SX620 HS", manufacturer: "Canon", category: "CAMERA", serial: "PSX620-412061508", procured: "2022-08-01", warranty: "2024-08-01", value: 15990, funding: "DOST-SEI", accessories: "battery, charger, wrist strap", condition: "OPERATIONAL", registeredDaysAgo: 186 },

  { tag: "CAR-0001", name: "ViewPlus MM-27KI 27\" 2K IPS Monitor", manufacturer: "ViewPlus", category: "MONITOR", serial: "MM27KI-2401-0583", procured: "2024-02-22", warranty: "2026-02-22", value: 11500, funding: "DOST-PCIEERD", project: "CAR-2024-03", its: "231-010244", accessories: "power adapter, HDMI cable", condition: "PERFECT", registeredDaysAgo: 186 },
  { tag: "CAR-0002", name: "ViewPlus MM-27KI 27\" 2K IPS Monitor", manufacturer: "ViewPlus", category: "MONITOR", serial: "MM27KI-2401-0591", procured: "2024-02-22", warranty: "2026-02-22", value: 11500, funding: "DOST-PCIEERD", accessories: "power adapter, HDMI cable", condition: "PERFECT", registeredDaysAgo: 186 },
  { tag: "CAR-0003", name: "NVIDIA Jetson Nano Developer Kit", manufacturer: "NVIDIA", category: "DEV_KIT", serial: "1422019013577", procured: "2024-03-12", warranty: "2025-03-12", value: 9800, funding: "DOST-PCIEERD", project: "CAR-2024-03", its: "231-010297", accessories: "power supply, 64GB microSD card", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.8 }, registeredDaysAgo: 186 },
  { tag: "CAR-0004", name: "LDROBOT LD06 LiDAR Sensor", manufacturer: "LDROBOT", category: "DEV_KIT", serial: "LD06-2309-11872", procured: "2024-03-12", warranty: "2025-03-12", value: 4200, funding: "DOST-PCIEERD", project: "CAR-2024-03", accessories: "adapter board, cable", condition: "PERFECT", metrics: { SENSOR_DRIFT: 1.2, MOTOR_SPEED: 600 }, registeredDaysAgo: 186 },
  { tag: "CAR-0005", name: "Arduino Uno R3", manufacturer: "Arduino", category: "DEV_KIT", serial: "A000066-7524A1", procured: "2024-03-12", warranty: "2025-03-12", value: 1450, funding: "Internal Grants", its: "231-010318", accessories: "USB cable", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.5 }, registeredDaysAgo: 8 },

  { tag: "CeHCI-0001", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ236", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", its: "208-002117", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 185 },
  { tag: "CeHCI-0002", name: "HP Z2 Tower G9 Workstation", manufacturer: "HP", category: "CPU", serial: "2UA4321XK7", procured: "2024-08-15", warranty: "2027-08-15", value: 168000, funding: "DOST-SEI", project: "CEHCI-2024-04", its: "208-006630", accessories: "keyboard, mouse", condition: "PERFECT", metrics: TOWER(64), registeredDaysAgo: 185 },
  { tag: "CeHCI-0003", name: "HP Z2 Tower G9 Workstation", manufacturer: "HP", category: "CPU", serial: "2UA4321XL2", procured: "2024-08-15", warranty: { daysFromSeed: 10 }, value: 168000, funding: "DOST-SEI", project: "CEHCI-2024-04", accessories: "keyboard, mouse", condition: "PERFECT", metrics: TOWER(65), registeredDaysAgo: 185 },
  { tag: "CeHCI-0004", name: "Wacom Intuos Wireless (CTL-4100WL)", manufacturer: "Wacom", category: "TABLET", serial: "8HQ01A004127", procured: "2023-08-01", warranty: "2024-08-01", value: 4990, funding: "Internal Grants", accessories: "pen, USB cable", condition: "OPERATIONAL", metrics: { BATTERY_CAPACITY: 94 }, registeredDaysAgo: 185 },
  { tag: "CeHCI-0005", name: "One by Wacom Medium", manufacturer: "Wacom", category: "TABLET", serial: "1KQ00R010384", procured: "2023-08-01", warranty: "2024-08-01", value: 3490, funding: "Internal Grants", its: "208-005512", accessories: "pen, USB cable", condition: "OPERATIONAL", registeredDaysAgo: 185 },

  { tag: "CIVI-0001", name: "Acer Nitro ED320QR 31.5\" Curved Monitor", manufacturer: "Acer", category: "MONITOR", serial: "MMTL1SS0024150B1", procured: "2024-03-18", warranty: "2026-03-18", value: 18990, funding: "DOST-SEI", its: "226-008841", accessories: "power cable, HDMI cable", condition: "PERFECT", registeredDaysAgo: 183 },
  { tag: "CIVI-0002", name: "Acer Nitro ED320QR 31.5\" Curved Monitor", manufacturer: "Acer", category: "MONITOR", serial: "MMTL1SS0024150C7", procured: "2024-03-18", warranty: "2026-03-18", value: 18990, funding: "DOST-SEI", accessories: "power cable, HDMI cable", condition: "PERFECT", registeredDaysAgo: 183 },
  { tag: "CIVI-0003", name: "Lenovo Legion Tower 7i Gen 8", manufacturer: "Lenovo", category: "CPU", serial: "MJ0K7T2D", procured: "2024-06-16", warranty: { daysFromSeed: 25 }, value: 145000, funding: "DOST-SEI", its: "226-008902", accessories: "keyboard, mouse", condition: "PERFECT", metrics: TOWER(66), registeredDaysAgo: 183 },
  { tag: "CIVI-0004", name: "Raspberry Pi Camera Module v2", manufacturer: "Raspberry Pi", category: "DEV_KIT", serial: "RPICAM2-24-03318", procured: "2024-03-12", warranty: "2025-03-12", value: 1650, funding: "Internal Grants", accessories: "ribbon cable", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.9 }, registeredDaysAgo: 4 },

  { tag: "CeLT-0001", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ249", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", its: "219-001846", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 185 },
  { tag: "CeLT-0002", name: "Acer Predator PO5-615s", manufacturer: "Acer", category: "CPU", serial: "DTBAUSP0049100C2", procured: "2018-08-01", warranty: "2021-08-01", value: 89000, funding: "Internal Grants", its: "219-000733", accessories: "keyboard, mouse", condition: "MINOR_DRIFT", metrics: TOWER(71, 2), registeredDaysAgo: 185 },
  { tag: "CeLT-0003", name: "Acer Nitro VG240Y 23.8\" Monitor", manufacturer: "Acer", category: "MONITOR", serial: "MMT1HSS0018350A4", procured: "2018-08-01", warranty: "2021-08-01", value: 8500, funding: "Internal Grants", accessories: "power cable, HDMI cable", condition: "MINOR_DRIFT", registeredDaysAgo: 185 },
  { tag: "CeLT-0004", name: "Acer Nitro VG240Y 23.8\" Monitor", manufacturer: "Acer", category: "MONITOR", serial: "MMT1HSS0018350B9", procured: "2018-08-01", warranty: "2021-08-01", value: 8500, funding: "Internal Grants", its: "219-000735", accessories: "power cable, HDMI cable", condition: "MINOR_DRIFT", registeredDaysAgo: 185 },

  { tag: "CNIS-0001", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ257", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 186 },
  { tag: "CNIS-0002", name: "MikroTik RB952Ui-5ac2nD Router", manufacturer: "MikroTik", category: "ROUTER", serial: "HE408P1QW2K", procured: "2024-05-29", warranty: "2025-05-29", value: 2950, funding: "DOST", project: "CNIS-2024-02", its: "245-011093", accessories: "power adapter", condition: "PERFECT", metrics: { WORKING_PORTS: 5, PACKET_LOSS: 0.2 }, registeredDaysAgo: 186 },
  { tag: "CNIS-0003", name: "MikroTik RB952Ui-5ac2nD Router", manufacturer: "MikroTik", category: "ROUTER", serial: "HE408P1QW3M", procured: "2024-05-29", warranty: "2025-05-29", value: 2950, funding: "DOST", accessories: "power adapter", condition: "PERFECT", metrics: { WORKING_PORTS: 5, PACKET_LOSS: 0.2 }, registeredDaysAgo: 186 },
  { tag: "CNIS-0004", name: "Arduino Sensor Kit (Base)", manufacturer: "Arduino", category: "DEV_KIT", serial: "AKX00026-24170", procured: "2024-05-29", warranty: "2025-05-29", value: 2600, funding: "DOST", project: "CNIS-2024-02", its: "245-011101", accessories: "Grove cables", condition: "PERFECT", metrics: { SENSOR_DRIFT: 1.5 }, registeredDaysAgo: 186 },
  { tag: "CNIS-0005", name: "Raspberry Pi 4 Model B 8GB", manufacturer: "Raspberry Pi", category: "DEV_KIT", serial: "RPI4B8-24-118752", procured: "2024-05-29", warranty: "2025-05-29", value: 5800, funding: "DOST", project: "CNIS-2024-02", accessories: "power supply, case, 32GB microSD card", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.7 }, registeredDaysAgo: 186 },
  { tag: "CNIS-0006", name: "Raspberry Pi 4 Model B 8GB", manufacturer: "Raspberry Pi", category: "DEV_KIT", serial: "RPI4B8-24-118769", procured: "2024-05-29", warranty: "2025-05-29", value: 5800, funding: "DOST", its: "245-011104", accessories: "power supply, case, 32GB microSD card", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.7 }, registeredDaysAgo: 186 },
  { tag: "CNIS-0007", name: "ESP32-DevKitC V4", manufacturer: "Espressif", category: "DEV_KIT", serial: "ESP32DKC-24-30417", procured: "2024-05-29", warranty: "2025-05-29", value: 650, funding: "DOST", project: "CNIS-2024-02", accessories: "USB cable", condition: "PERFECT", metrics: { SENSOR_DRIFT: 1.0 }, registeredDaysAgo: 186 },

  { tag: "GAME-0001", name: "Wacom Intuos Draw (CTL-490)", manufacturer: "Wacom", category: "TABLET", serial: "5DQ00J018832", procured: "2023-03-28", warranty: "2024-03-28", value: 3990, funding: "CHED", its: "237-007215", accessories: "pen, USB cable", condition: "OPERATIONAL", registeredDaysAgo: 184 },
  { tag: "GAME-0002", name: "Wacom Intuos Draw (CTL-490)", manufacturer: "Wacom", category: "TABLET", serial: "5DQ00J018847", procured: "2023-03-28", warranty: "2024-03-28", value: 3990, funding: "CHED", accessories: "pen, USB cable", condition: "OPERATIONAL", registeredDaysAgo: 184 },
  { tag: "GAME-0003", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ263", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", its: "237-005078", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 184 },
  { tag: "GAME-0004", name: "Meta Quest 2 128GB", manufacturer: "Meta", category: "VR", serial: "1WMHH8212C0471", procured: "2022-08-01", warranty: "2023-08-01", value: 21990, funding: "CHED", project: "GAME-2023-02", its: "237-006120", accessories: "2 controllers, charging cable, glasses spacer", condition: "OPERATIONAL", metrics: { BATTERY_CAPACITY: 91 }, registeredDaysAgo: 184 },
  { tag: "GAME-0005", name: "Meta Quest 2 128GB", manufacturer: "Meta", category: "VR", serial: "1WMHH8212C0488", procured: "2022-08-01", warranty: "2023-08-01", value: 21990, funding: "CHED", project: "GAME-2023-02", accessories: "2 controllers, charging cable, glasses spacer", condition: "OPERATIONAL", metrics: { BATTERY_CAPACITY: 89 }, registeredDaysAgo: 184 },
  { tag: "GAME-0006", name: "Meta Quest 2 128GB", manufacturer: "Meta", category: "VR", serial: "1WMHH8212C0493", procured: "2022-08-01", warranty: "2023-08-01", value: 21990, funding: "CHED", project: "GAME-2023-02", its: "237-006122", accessories: "2 controllers, charging cable, glasses spacer", condition: "OPERATIONAL", metrics: { BATTERY_CAPACITY: 92 }, registeredDaysAgo: 184 },
  { tag: "GAME-0007", name: "HP Z2 Tower G9 Workstation", manufacturer: "HP", category: "CPU", serial: "2UA4321XN9", procured: "2024-08-15", warranty: "2027-08-15", value: 168000, funding: "CHED", accessories: "keyboard, mouse", condition: "OPERATIONAL", metrics: TOWER(63), registeredDaysAgo: 184 },

  { tag: "HXIL-0001", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ270", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 183 },
  { tag: "HXIL-0002", name: "Apple Mac mini (M2)", manufacturer: "Apple", category: "CPU", serial: "C02KT1Q9PJH7", procured: "2023-09-15", warranty: "2024-09-15", value: 39990, funding: "DOST-SEI", project: "HXIL-2023-05", its: "252-009366", accessories: "power cable", condition: "OPERATIONAL", metrics: TOWER(58), registeredDaysAgo: 183 },
  { tag: "HXIL-0003", name: "Logitech G29 Driving Force Racing Wheel", manufacturer: "Logitech", category: "SIMULATOR", serial: "2319LZX0A4R8", procured: "2023-03-14", warranty: "2025-03-14", value: 18995, funding: "DOST-SEI", project: "HXIL-2023-05", its: "252-008711", accessories: "pedal set, power adapter", condition: "OPERATIONAL", metrics: { SENSOR_DRIFT: 0.6, MOTOR_SPEED: 2400 }, registeredDaysAgo: 183 },
  { tag: "HXIL-0004", name: "Logitech G29 Driving Force Racing Wheel", manufacturer: "Logitech", category: "SIMULATOR", serial: "2319LZX0A4S3", procured: "2023-03-14", warranty: "2025-03-14", value: 18995, funding: "DOST-SEI", accessories: "pedal set, power adapter", condition: "OPERATIONAL", metrics: { SENSOR_DRIFT: 0.7, MOTOR_SPEED: 2400 }, registeredDaysAgo: 183 },
  { tag: "HXIL-0005", name: "Wheel Stand Pro for Logitech G29", manufacturer: "Wheel Stand Pro", category: "SIMULATOR", serial: "WSP-G29-230707-14", procured: "2023-07-07", warranty: "2024-07-07", value: 9500, funding: "DOST-SEI", project: "HXIL-2023-05", condition: "OPERATIONAL", registeredDaysAgo: 183 },
  { tag: "HXIL-0006", name: "One by Wacom Small", manufacturer: "Wacom", category: "TABLET", serial: "1KQ00S004461", procured: "2023-08-01", warranty: "2024-08-01", value: 2490, funding: "Personal (self-funded)", accessories: "pen, USB cable", condition: "OPERATIONAL", registeredDaysAgo: 183 },

  { tag: "TE3D-0001", name: "Canon PIXMA G3020 Ink Tank Printer", manufacturer: "Canon", category: "PRINTER", serial: "KLMB04218", procured: "2022-09-09", warranty: "2024-09-09", value: 9995, funding: "Internal Grants", its: "263-004409", accessories: "ink bottles, USB cable", condition: "OPERATIONAL", registeredDaysAgo: 185 },
  { tag: "TE3D-0002", name: "LG 65\" UHD 4K Smart TV", manufacturer: "LG", category: "TV", serial: "65UQ7550-108KRXQ284", procured: "2021-08-01", warranty: "2023-08-01", value: 52990, funding: "CHED", accessories: "remote control, wall bracket", condition: "OPERATIONAL", registeredDaysAgo: 185 },
  { tag: "TE3D-0003", name: "Linksys LGS3G2C 48-Port Gigabit Switch", manufacturer: "Linksys", category: "SWITCH", serial: "16F10C2A904417", procured: "2022-07-02", warranty: "2025-07-02", value: 24500, funding: "Internal Grants", its: "263-004127", accessories: "rack ears, power cable", condition: "OPERATIONAL", metrics: { WORKING_PORTS: 48, PACKET_LOSS: 0.1 }, registeredDaysAgo: 185 },
  { tag: "TE3D-0004", name: "WD My Book 8TB External Drive", manufacturer: "Western Digital", category: "HARD_DRIVE", serial: "WX52D72LKA3P", procured: "2022-09-09", warranty: "2025-09-09", value: 10490, funding: "Internal Grants", project: "TE3D-2024-01", its: "263-004411", accessories: "power adapter, USB cable", condition: "OPERATIONAL", metrics: { BAD_SECTORS: 0, READ_SPEED: 195 }, registeredDaysAgo: 185 },
  { tag: "TE3D-0005", name: "Seagate One Touch 1TB Portable Drive", manufacturer: "Seagate", category: "HARD_DRIVE", serial: "NAB3KX9T", procured: "2022-09-09", warranty: "2024-09-09", value: 3490, funding: "Personal (self-funded)", accessories: "USB cable", condition: "OPERATIONAL", metrics: { BAD_SECTORS: 0, READ_SPEED: 132 }, registeredDaysAgo: 185 },
  { tag: "TE3D-0006", name: "Focusrite Scarlett Solo (3rd Gen)", manufacturer: "Focusrite", category: "AUDIO", serial: "S3V2KQ1093725", procured: "2023-05-05", warranty: "2026-05-05", value: 7490, funding: "Internal Grants", project: "TE3D-2024-01", its: "263-005830", accessories: "USB cable", condition: "OPERATIONAL", registeredDaysAgo: 185 },
  { tag: "TE3D-0007", name: "Wacom Intuos Medium (CTL-6100)", manufacturer: "Wacom", category: "TABLET", serial: "9JQ00H021904", procured: "2023-06-01", warranty: "2024-06-01", value: 9990, funding: "Internal Grants", accessories: "pen, USB cable", condition: "OPERATIONAL", registeredDaysAgo: 185 },
  { tag: "TE3D-0008", name: "Sony HDR-CX405 Handycam", manufacturer: "Sony", category: "VIDEO_CAMERA", serial: "HDRCX405-3410287", procured: "2024-05-30", warranty: { daysFromSeed: 60 }, value: 11990, funding: "Internal Grants", project: "TE3D-2024-01", its: "263-006952", accessories: "battery, charger, AV cable", condition: "PERFECT", registeredDaysAgo: 185 },
  { tag: "TE3D-0009", name: "JBL Flip 6 Bluetooth Speaker", manufacturer: "JBL", category: "SPEAKER", serial: "TL0624-JF6-17722", procured: "2024-05-30", warranty: "2025-05-30", value: 6990, funding: "Internal Grants", accessories: "USB-C cable", condition: "PERFECT", registeredDaysAgo: 185 },

  { tag: "Bio-0001", name: "HP Z2 Tower G9 Workstation", manufacturer: "HP", category: "CPU", serial: "2UA4321XP4", procured: "2024-08-15", warranty: "2027-08-15", value: 168000, funding: "DOST-PCIEERD", its: "270-001208", accessories: "keyboard, mouse", condition: "PERFECT", metrics: TOWER(64), registeredDaysAgo: 184 },
  { tag: "Bio-0002", name: "NVIDIA Jetson AGX Orin 64GB Developer Kit", manufacturer: "NVIDIA", category: "DEV_KIT", serial: "1424124027811", procured: "2024-03-12", warranty: "2025-03-12", value: 125000, funding: "DOST-PCIEERD", its: "270-001214", accessories: "power supply, USB-C cable", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.6 }, registeredDaysAgo: 19 },
  { tag: "Bio-0003", name: "Raspberry Pi 4 Model B 4GB", manufacturer: "Raspberry Pi", category: "DEV_KIT", serial: "RPI4B4-24-207731", procured: "2024-03-12", warranty: "2025-03-12", value: 3900, funding: "Internal Grants", accessories: "power supply, case", condition: "PERFECT", metrics: { SENSOR_DRIFT: 0.8 }, registeredDaysAgo: 19 },
  { tag: "Bio-0004", name: "ESP32-CAM Development Board", manufacturer: "AI-Thinker", category: "DEV_KIT", serial: "ESP32CAM-24-55126", procured: "2024-03-12", warranty: "2025-03-12", value: 650, funding: "Internal Grants", accessories: "OV2640 camera, USB programmer", condition: "PERFECT", metrics: { SENSOR_DRIFT: 1.1 }, registeredDaysAgo: 12 },
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
