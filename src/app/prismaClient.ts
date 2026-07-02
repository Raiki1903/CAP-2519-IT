// Simulated database storage using localStorage to act as a MySQL Database
// It implements a subset of Prisma Client API in TypeScript

export type UserType = "STUDENT" | "FACULTY";

export type RoleName = "ADMIN" | "ADRIC_DIRECTOR" | "ADRIC_SECRETARY" | "TSG_STAFF" | "LAB_HEAD";

export type CampusLocation = "MANILA_CAMPUS" | "LAGUNA_CAMPUS";

export type AssetType =
  | "DEV_KIT"
  | "MONITOR"
  | "TV"
  | "CPU"
  | "KEYBOARD"
  | "MOUSE"
  | "CAMERA"
  | "MEMORY_CARD"
  | "PROJECTOR"
  | "RECORDER"
  | "ROUTER"
  | "SIMULATOR"
  | "TABLET"
  | "VR"
  | "PRINTER"
  | "SWITCH"
  | "HARD_DRIVE"
  | "AUDIO"
  | "VIDEO_CAMERA"
  | "SPEAKER";

export type AssetStatus = "ACTIVE" | "IN_REPAIR" | "DISPOSED";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type RepairStatus = "REPORTED" | "IN_PROGRESS" | "COMPLETED";

// Database Types conforming to schema.prisma
export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  idNumber: number;
  userType: UserType;
}

export interface Role {
  roleId: number;
  roleName: RoleName;
}

export interface UserRole {
  userRoleId: number;
  userId: number;
  roleId: number;
}

export interface ResearchCenter {
  centerId: number;
  centerName: string;
  campusLocation: CampusLocation;
}

export interface UserCenter {
  userCentersId: number;
  userId: number;
  centerId: number;
}

export interface Asset {
  assetId: number;
  qrCodeHash: string;
  assetName: string;
  assetType: AssetType;
  centerId: number;
  serial: string;
  manufacturer: string;
  funding: string;
  procured: string;
  warranty: string;
  condition: number;
  status: string; // Map to UI status strings like "Active", "On Loan", "Maintenance", "Disposed"
  custodianId?: number; // User ID
  borrowedOn?: string;
  dueDate?: string;
}

export interface AssetRecord {
  assetRecordId: number;
  status: AssetStatus;
  location: string;
  date: string;
  currentCustodian: number; // userId
  transferId?: number;
  disposalId?: number;
  repairId?: number;
  assetId: number;
}

export interface AssetTag {
  assetTagId: number;
  itsPropertyTag: string;
  tsgPropertyTag: string;
  assetId: number;
}

export interface AssetMonetary {
  assetMonetaryId: number;
  fundingSource: string;
  acquisitionValue: number;
  assetId: number;
}

export interface CustodianshipTransfer {
  transferId: number;
  assetId: number;
  previousCustodianId: number;
  newCustodianId: number;
  transferDate: string;
  approvalStatus: ApprovalStatus;
  // UI helper fields
  uiId: string;
  lab: string;
}

export interface AssetDisposal {
  disposalId: number;
  assetId: number;
  disposedById: number;
  disposalDate: string;
  disposalReason: string;
  // UI helper fields
  pathway: string;
}

export interface AssetRepair {
  repairId: number;
  assetId: number;
  reportedById: number;
  issueDescription: string;
  startDate: string;
  completionDate?: string;
  repairStatus: RepairStatus;
  // UI helper fields
  uiId: string;
  priority: "Medium" | "High" | "Critical";
  acknowledged: boolean;
  forwardedTo?: "TSG" | "ITS" | "Both";
}

interface DatabaseState {
  users: User[];
  roles: Role[];
  userRoles: UserRole[];
  researchCenters: ResearchCenter[];
  userCenters: UserCenter[];
  assets: Asset[];
  assetRecords: AssetRecord[];
  assetTags: AssetTag[];
  assetMonetaries: AssetMonetary[];
  transfers: CustodianshipTransfer[];
  disposals: AssetDisposal[];
  repairs: AssetRepair[];
}

const STORAGE_KEY = "dlsu_equipment_ms_db_v2";

const seedData: DatabaseState = {
  users: [
    { userId: 1, firstName: "ITS", lastName: "Admin", email: "its@dlsu.edu.ph", password: "its_password", idNumber: 11111111, userType: "FACULTY" },
    { userId: 2, firstName: "TSG", lastName: "Staff", email: "tsg@dlsu.edu.ph", password: "tsg_password", idNumber: 22222222, userType: "FACULTY" },
    { userId: 3, firstName: "Dr. Juan", lastName: "Dela Cruz", email: "labhead@dlsu.edu.ph", password: "labhead_password", idNumber: 33333333, userType: "FACULTY" },
    { userId: 4, firstName: "A.", lastName: "Dela Cruz", email: "custodian@dlsu.edu.ph", password: "custodian_password", idNumber: 44444444, userType: "STUDENT" },
    { userId: 5, firstName: "Dr.", lastName: "Santos", email: "dr.santos@dlsu.edu.ph", password: "password123", idNumber: 55555555, userType: "FACULTY" },
    { userId: 6, firstName: "A.", lastName: "Garcia", email: "a.garcia@dlsu.edu.ph", password: "password123", idNumber: 66666666, userType: "FACULTY" },
    { userId: 7, firstName: "M.", lastName: "Tan", email: "m.tan@dlsu.edu.ph", password: "password123", idNumber: 77777777, userType: "FACULTY" },
    { userId: 8, firstName: "J.", lastName: "Sy", email: "j.sy@dlsu.edu.ph", password: "password123", idNumber: 88888888, userType: "FACULTY" },
    { userId: 9, firstName: "Felix", lastName: "Torres", email: "felix.torres@dlsu.edu.ph", password: "password123", idNumber: 99999999, userType: "FACULTY" },
    { userId: 10, firstName: "T.", lastName: "Lim", email: "t.lim@dlsu.edu.ph", password: "password123", idNumber: 10101010, userType: "FACULTY" }
  ],
  roles: [
    { roleId: 1, roleName: "ADMIN" },
    { roleId: 2, roleName: "ADRIC_DIRECTOR" },
    { roleId: 3, roleName: "ADRIC_SECRETARY" },
    { roleId: 4, roleName: "TSG_STAFF" },
    { roleId: 5, roleName: "LAB_HEAD" }
  ],
  userRoles: [
    { userRoleId: 1, userId: 1, roleId: 1 },
    { userRoleId: 2, userId: 2, roleId: 4 },
    { userRoleId: 3, userId: 3, roleId: 5 },
    { userRoleId: 4, userId: 5, roleId: 5 },
    { userRoleId: 5, userId: 7, roleId: 5 }
  ],
  researchCenters: [
    { centerId: 1, centerName: "CITe4D", campusLocation: "MANILA_CAMPUS" },
    { centerId: 2, centerName: "CAR", campusLocation: "LAGUNA_CAMPUS" },
    { centerId: 3, centerName: "CeHCI", campusLocation: "MANILA_CAMPUS" },
    { centerId: 4, centerName: "HXIL", campusLocation: "LAGUNA_CAMPUS" },
    { centerId: 5, centerName: "GAME", campusLocation: "MANILA_CAMPUS" },
    { centerId: 6, centerName: "CeLT", campusLocation: "LAGUNA_CAMPUS" },
    { centerId: 7, centerName: "Bio", campusLocation: "MANILA_CAMPUS" }
  ],
  userCenters: [
    { userCentersId: 1, userId: 1, centerId: 1 },
    { userCentersId: 2, userId: 2, centerId: 1 },
    { userCentersId: 3, userId: 3, centerId: 1 },
    { userCentersId: 4, userId: 4, centerId: 1 }
  ],
  assets: [
    { assetId: 1, qrCodeHash: "hash-001", assetName: "Dell PowerEdge R740 Server", assetType: "CPU", centerId: 1, serial: "SN-DPE-740-001", manufacturer: "Dell Technologies", funding: "DOST", procured: "2024-01-15", warranty: "2027-01-15", condition: 96, status: "On Loan", custodianId: 5 },
    { assetId: 2, qrCodeHash: "hash-002", assetName: "NVIDIA DGX A100 Workstation", assetType: "CPU", centerId: 2, serial: "SN-DGX-A100-02", manufacturer: "NVIDIA Corporation", funding: "USAID", procured: "2024-02-20", warranty: "2026-02-20", condition: 82, status: "Active" },
    { assetId: 3, qrCodeHash: "hash-003", assetName: "UR10e Collaborative Robot", assetType: "SIMULATOR", centerId: 3, serial: "SN-UR10e-0034", manufacturer: "Universal Robots", category: "Robotic Node", funding: "CHED", procured: "2024-03-10", warranty: "2026-03-10", condition: 91, status: "Active" },
    { assetId: 4, qrCodeHash: "hash-004", assetName: "Boston Dynamics Spot Robot", assetType: "SIMULATOR", centerId: 4, serial: "SN-SPOT-0178", manufacturer: "Boston Dynamics", funding: "Internal Grants", procured: "2023-11-05", warranty: "2025-11-05", condition: 67, status: "Maintenance" },
    { assetId: 5, qrCodeHash: "hash-005", assetName: "Leica BLK360 3D Scanner", assetType: "CAMERA", centerId: 1, serial: "SN-LBK-360-09", manufacturer: "Leica Geosystems", funding: "DOST", procured: "2024-04-01", warranty: "2027-04-01", condition: 99, status: "On Loan", custodianId: 6 },
    { assetId: 6, qrCodeHash: "hash-006", assetName: "Surface Pro 9 i7 (Bundle×12)", assetType: "TABLET", centerId: 5, serial: "SN-SP9-BNDL-03", manufacturer: "Microsoft", funding: "CHED", procured: "2024-05-22", warranty: "2026-05-22", condition: 88, status: "Active" },
    { assetId: 7, qrCodeHash: "hash-007", assetName: "Raspberry Pi 4 Cluster (×32)", assetType: "DEV_KIT", centerId: 6, serial: "SN-RPI4-CLU-07", manufacturer: "Raspberry Pi Ltd", funding: "USAID", procured: "2024-06-01", warranty: "2026-06-01", condition: 94, status: "Active" },
    { assetId: 8, qrCodeHash: "hash-008", assetName: "Phantom VEO4K Ultra-HSC", assetType: "CAMERA", centerId: 7, serial: "SN-PH-VEO-4K-01", manufacturer: "Vision Research", funding: "DOST", procured: "2024-01-28", warranty: "2027-01-28", condition: 100, status: "Active" },
    { assetId: 9, qrCodeHash: "hash-009", assetName: "Cisco Catalyst 9300 Switch", assetType: "SWITCH", centerId: 1, serial: "FCW2549L0GR", manufacturer: "Cisco Systems", funding: "CHED", procured: "2024-06-09", warranty: "2027-06-09", condition: 100, status: "Active" },
    { assetId: 10, qrCodeHash: "hash-010", assetName: "Vuzix M400 Smart Glasses ×4", assetType: "VR", centerId: 2, serial: "VX-M400-DLSU", manufacturer: "Vuzix", funding: "Internal Grants", procured: "2024-06-06", warranty: "2026-06-06", condition: 90, status: "Active" },

    // Custodian's own borrowed assets
    { assetId: 11, qrCodeHash: "hash-011", assetName: "MacBook Pro M2 Max", assetType: "CPU", centerId: 1, serial: "C02Z4K01Q6LR", manufacturer: "Apple Inc.", funding: "Internal Grants", procured: "2024-02-15", warranty: "2027-02-15", condition: 88, status: "On Loan", custodianId: 4, borrowedOn: "Jun 01, 2026", dueDate: "Jun 30, 2026" },
    { assetId: 12, qrCodeHash: "hash-012", assetName: "Raspberry Pi 4 Kit ×3", assetType: "DEV_KIT", centerId: 6, serial: "RPI4-DLSU-009", manufacturer: "Raspberry Pi Ltd", funding: "Internal Grants", procured: "2024-03-20", warranty: "2026-03-20", condition: 85, status: "On Loan", custodianId: 4, borrowedOn: "May 20, 2026", dueDate: "Jun 20, 2026" },
    { assetId: 13, qrCodeHash: "hash-013", assetName: "Vuzix M400 Smart Glass", assetType: "VR", centerId: 2, serial: "VX-M400-007", manufacturer: "Vuzix", funding: "Internal Grants", procured: "2024-04-10", warranty: "2026-04-10", condition: 90, status: "On Loan", custodianId: 4, borrowedOn: "Jun 05, 2026", dueDate: "Jul 05, 2026" },

    { assetId: 14, qrCodeHash: "hash-014", assetName: "Dell PowerEdge R740 Server", assetType: "CPU", centerId: 1, serial: "SN-DPE-740-001", manufacturer: "Dell", funding: "DOST", procured: "2024-03-15", warranty: "2027-03-15", condition: 94, status: "On Loan", custodianId: 4 },
    { assetId: 15, qrCodeHash: "hash-015", assetName: "NVIDIA DGX A100 Workstation", assetType: "CPU", centerId: 2, serial: "SN-DGX-A100-02", manufacturer: "NVIDIA", funding: "Internal Grants", procured: "2024-06-20", warranty: "2026-06-20", condition: 88, status: "On Loan", custodianId: 7 },
    { assetId: 16, qrCodeHash: "hash-016", assetName: "UR10e Cobot Robotic Arm", assetType: "SIMULATOR", centerId: 3, serial: "SN-UR10e-0034", manufacturer: "Universal Robots", funding: "USAST", procured: "2024-01-10", warranty: "2025-01-10", condition: 72, status: "On Loan", custodianId: 8 },
    { assetId: 17, qrCodeHash: "hash-017", assetName: "Boston Dynamics Spot Robot", assetType: "SIMULATOR", centerId: 3, serial: "SN-SPOT-0178", manufacturer: "Boston Dynamics", funding: "CHED", procured: "2023-11-05", warranty: "2024-11-05", condition: 54, status: "On Loan", custodianId: 9 },
    { assetId: 18, qrCodeHash: "hash-018", assetName: "Leica BLK360 Laser Scanner", assetType: "CAMERA", centerId: 1, serial: "SN-LBK-360-09", manufacturer: "Leica", funding: "USAID", procured: "2024-02-18", warranty: "2026-02-18", condition: 91, status: "On Loan", custodianId: 4 },
    { assetId: 19, qrCodeHash: "hash-019", assetName: "Surface Pro 9 Tablet Bundle (x8)", assetType: "TABLET", centerId: 5, serial: "SN-SP9-BNDL-03", manufacturer: "Microsoft", funding: "Internal Grants", procured: "2024-05-01", warranty: "2025-05-01", condition: 83, status: "On Loan", custodianId: 10 },
    { assetId: 20, qrCodeHash: "hash-020", assetName: "Raspberry Pi 4 Cluster (32 nodes)", assetType: "DEV_KIT", centerId: 6, serial: "SN-RPI4-CLU-07", manufacturer: "Raspberry Pi", funding: "DOST", procured: "2024-04-12", warranty: "2025-04-12", condition: 96, status: "On Loan", custodianId: 4 }
  ],
  assetRecords: [],
  assetTags: [],
  assetMonetaries: [
    { assetMonetaryId: 1, fundingSource: "DOST", acquisitionValue: 250000, assetId: 1 },
    { assetMonetaryId: 2, fundingSource: "USAID", acquisitionValue: 950000, assetId: 2 },
    { assetMonetaryId: 3, fundingSource: "CHED", acquisitionValue: 1200000, assetId: 3 },
    { assetMonetaryId: 4, fundingSource: "Internal Grants", acquisitionValue: 3500000, assetId: 4 },
    { assetMonetaryId: 5, fundingSource: "DOST", acquisitionValue: 750000, assetId: 5 },
    { assetMonetaryId: 6, fundingSource: "CHED", acquisitionValue: 450000, assetId: 6 },
    { assetMonetaryId: 7, fundingSource: "USAID", acquisitionValue: 120000, assetId: 7 },
    { assetMonetaryId: 8, fundingSource: "DOST", acquisitionValue: 1800000, assetId: 8 },
    { assetMonetaryId: 9, fundingSource: "CHED", acquisitionValue: 150000, assetId: 9 },
    { assetMonetaryId: 10, fundingSource: "Internal Grants", acquisitionValue: 380000, assetId: 10 },
    { assetMonetaryId: 11, fundingSource: "Internal Grants", acquisitionValue: 180000, assetId: 11 },
    { assetMonetaryId: 12, fundingSource: "Internal Grants", acquisitionValue: 45000, assetId: 12 },
    { assetMonetaryId: 13, fundingSource: "Internal Grants", acquisitionValue: 95000, assetId: 13 },
    { assetMonetaryId: 14, fundingSource: "DOST", acquisitionValue: 245000, assetId: 14 },
    { assetMonetaryId: 15, fundingSource: "Internal Grants", acquisitionValue: 960000, assetId: 15 },
    { assetMonetaryId: 16, fundingSource: "USAST", acquisitionValue: 1150000, assetId: 16 },
    { assetMonetaryId: 17, fundingSource: "CHED", acquisitionValue: 3450000, assetId: 17 },
    { assetMonetaryId: 18, fundingSource: "USAID", acquisitionValue: 720000, assetId: 18 },
    { assetMonetaryId: 19, fundingSource: "Internal Grants", acquisitionValue: 320000, assetId: 19 },
    { assetMonetaryId: 20, fundingSource: "DOST", acquisitionValue: 125000, assetId: 20 }
  ],
  transfers: [
    { transferId: 1, assetId: 1, previousCustodianId: 4, newCustodianId: 3, transferDate: "Jun 20, 2026", approvalStatus: "PENDING", uiId: "TXN-2026-0035", lab: "CITe4D" },
    { transferId: 2, assetId: 2, previousCustodianId: 7, newCustodianId: 5, transferDate: "Jun 18, 2026", approvalStatus: "APPROVED", uiId: "TXN-2026-0036", lab: "CAR" },
    { transferId: 3, assetId: 4, previousCustodianId: 9, newCustodianId: 8, transferDate: "May 29, 2026", approvalStatus: "APPROVED", uiId: "TXN-2026-0037", lab: "HXIL" }
  ],
  disposals: [],
  repairs: [
    { repairId: 1, assetId: 4, reportedById: 9, issueDescription: "Battery capacity decayed below 60% standard baseline", startDate: "2026-05-10T10:00:00Z", completionDate: "2026-05-15T16:00:00Z", repairStatus: "COMPLETED", uiId: "MNT-001", priority: "High", acknowledged: true, forwardedTo: "TSG" },
    { repairId: 2, assetId: 4, reportedById: 9, issueDescription: "Joint encoder calibration failed - drift exceeding 2 degrees", startDate: "2026-06-12T14:30:00Z", repairStatus: "IN_PROGRESS", uiId: "MNT-002", priority: "Critical", acknowledged: true, forwardedTo: "TSG" },
    { repairId: 3, assetId: 1, reportedById: 5, issueDescription: "Storage sector failure count rising on SSD array", startDate: "2026-01-18T09:00:00Z", completionDate: "2026-01-20T17:00:00Z", repairStatus: "COMPLETED", uiId: "MNT-003", priority: "Medium", acknowledged: true, forwardedTo: "ITS" },
    { repairId: 4, assetId: 15, reportedById: 7, issueDescription: "GPU cooling fan failure causing high thermal profile", startDate: "2026-06-02T11:00:00Z", completionDate: "2026-06-05T15:00:00Z", repairStatus: "COMPLETED", uiId: "MNT-004", priority: "High", acknowledged: true, forwardedTo: "TSG" }
  ]
};

// Database helper functions
function getDb(): DatabaseState {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    return seedData;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    return seedData;
  }
}

function saveDb(db: DatabaseState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// Deep clone helper
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const prisma = {
  user: {
    findMany: async (args?: { include?: { userRoles?: boolean } }) => {
      const db = getDb();
      let users = clone(db.users);
      if (args?.include?.userRoles) {
        users = users.map(u => ({
          ...u,
          userRoles: db.userRoles
            .filter(ur => ur.userId === u.userId)
            .map(ur => ({
              ...ur,
              role: db.roles.find(r => r.roleId === ur.roleId)
            }))
        })) as any;
      }
      return users;
    },
    findUnique: async (args: { where: { userId?: number; email?: string }; include?: { userRoles?: { include?: { role?: boolean } } } }) => {
      const db = getDb();
      let user = db.users.find(u => {
        if (args.where.userId !== undefined) return u.userId === args.where.userId;
        if (args.where.email !== undefined) return u.email === args.where.email;
        return false;
      });
      if (!user) return null;
      const res = clone(user);
      if (args.include?.userRoles) {
        (res as any).userRoles = db.userRoles
          .filter(ur => ur.userId === user!.userId)
          .map(ur => ({
            ...ur,
            role: args.include?.userRoles?.include?.role
              ? db.roles.find(r => r.roleId === ur.roleId)
              : undefined
          }));
      }
      return res;
    },
    findFirst: async (args: { where: { email?: string; password?: string }; include?: { userRoles?: { include?: { role?: boolean } } } }) => {
      const db = getDb();
      let user = db.users.find(u => {
        let match = true;
        if (args.where.email !== undefined && u.email.toLowerCase() !== args.where.email.toLowerCase()) match = false;
        if (args.where.password !== undefined && u.password !== args.where.password) match = false;
        return match;
      });
      if (!user) return null;
      const res = clone(user);
      if (args.include?.userRoles) {
        (res as any).userRoles = db.userRoles
          .filter(ur => ur.userId === user!.userId)
          .map(ur => ({
            ...ur,
            role: args.include?.userRoles?.include?.role
              ? db.roles.find(r => r.roleId === ur.roleId)
              : undefined
          }));
      }
      return res as any;
    },
    create: async (args: { data: Omit<User, "userId"> }) => {
      const db = getDb();
      const nextId = db.users.reduce((max, u) => Math.max(max, u.userId), 0) + 1;
      const newUser = { ...args.data, userId: nextId };
      db.users.push(newUser);
      saveDb(db);
      return newUser;
    },
    update: async (args: { where: { userId: number }; data: Partial<User> }) => {
      const db = getDb();
      db.users = db.users.map(u => (u.userId === args.where.userId ? { ...u, ...args.data } : u));
      saveDb(db);
      return db.users.find(u => u.userId === args.where.userId) || null;
    }
  },

  role: {
    findMany: async () => {
      return clone(getDb().roles);
    },
    create: async (args: { data: Omit<Role, "roleId"> }) => {
      const db = getDb();
      const nextId = db.roles.reduce((max, r) => Math.max(max, r.roleId), 0) + 1;
      const newRole = { ...args.data, roleId: nextId };
      db.roles.push(newRole);
      saveDb(db);
      return newRole;
    }
  },

  userRole: {
    findMany: async () => {
      return clone(getDb().userRoles);
    },
    create: async (args: { data: Omit<UserRole, "userRoleId"> }) => {
      const db = getDb();
      const nextId = db.userRoles.reduce((max, ur) => Math.max(max, ur.userRoleId), 0) + 1;
      const newUr = { ...args.data, userRoleId: nextId };
      db.userRoles.push(newUr);
      saveDb(db);
      return newUr;
    }
  },

  researchCenter: {
    findMany: async () => {
      return clone(getDb().researchCenters);
    }
  },

  asset: {
    findMany: async () => {
      const db = getDb();
      return clone(db.assets);
    },
    findUnique: async (args: { where: { assetId: number } }) => {
      const db = getDb();
      return clone(db.assets.find(a => a.assetId === args.where.assetId) || null);
    },
    findFirst: async (args: { where: { serial?: string } }) => {
      const db = getDb();
      return clone(db.assets.find(a => a.serial === args.where.serial) || null);
    },
    create: async (args: { data: Omit<Asset, "assetId"> }) => {
      const db = getDb();
      const nextId = db.assets.reduce((max, a) => Math.max(max, a.assetId), 0) + 1;
      const newAsset = { ...args.data, assetId: nextId };
      db.assets.push(newAsset);
      saveDb(db);
      return newAsset;
    },
    update: async (args: { where: { assetId: number }; data: Partial<Asset> }) => {
      const db = getDb();
      db.assets = db.assets.map(a => (a.assetId === args.where.assetId ? { ...a, ...args.data } : a));
      saveDb(db);
      return clone(db.assets.find(a => a.assetId === args.where.assetId) || null);
    },
    delete: async (args: { where: { assetId: number } }) => {
      const db = getDb();
      const deleted = db.assets.find(a => a.assetId === args.where.assetId);
      db.assets = db.assets.filter(a => a.assetId !== args.where.assetId);
      saveDb(db);
      return clone(deleted || null);
    }
  },

  assetRecord: {
    findMany: async () => {
      return clone(getDb().assetRecords);
    },
    create: async (args: { data: Omit<AssetRecord, "assetRecordId"> }) => {
      const db = getDb();
      const nextId = db.assetRecords.reduce((max, r) => Math.max(max, r.assetRecordId), 0) + 1;
      const newRec = { ...args.data, assetRecordId: nextId };
      db.assetRecords.push(newRec);
      saveDb(db);
      return newRec;
    }
  },

  custodianshipTransfer: {
    findMany: async () => {
      return clone(getDb().transfers);
    },
    create: async (args: { data: Omit<CustodianshipTransfer, "transferId"> }) => {
      const db = getDb();
      const nextId = db.transfers.reduce((max, t) => Math.max(max, t.transferId), 0) + 1;
      const newTx = { ...args.data, transferId: nextId };
      db.transfers.push(newTx);
      saveDb(db);
      return newTx;
    },
    update: async (args: { where: { transferId: number }; data: Partial<CustodianshipTransfer> }) => {
      const db = getDb();
      db.transfers = db.transfers.map(t => (t.transferId === args.where.transferId ? { ...t, ...args.data } : t));
      saveDb(db);
      return clone(db.transfers.find(t => t.transferId === args.where.transferId) || null);
    }
  },

  assetDisposal: {
    findMany: async () => {
      return clone(getDb().disposals);
    },
    create: async (args: { data: Omit<AssetDisposal, "disposalId"> }) => {
      const db = getDb();
      const nextId = db.disposals.reduce((max, d) => Math.max(max, d.disposalId), 0) + 1;
      const newDisp = { ...args.data, disposalId: nextId };
      db.disposals.push(newDisp);
      saveDb(db);
      return newDisp;
    }
  },

  assetRepair: {
    findMany: async () => {
      return clone(getDb().repairs);
    },
    create: async (args: { data: Omit<AssetRepair, "repairId"> }) => {
      const db = getDb();
      const nextId = db.repairs.reduce((max, r) => Math.max(max, r.repairId), 0) + 1;
      const newRep = { ...args.data, repairId: nextId };
      db.repairs.push(newRep);
      saveDb(db);
      return newRep;
    },
    update: async (args: { where: { repairId: number }; data: Partial<AssetRepair> }) => {
      const db = getDb();
      db.repairs = db.repairs.map(r => (r.repairId === args.where.repairId ? { ...r, ...args.data } : r));
      saveDb(db);
      return clone(db.repairs.find(r => r.repairId === args.where.repairId) || null);
    }
  },

  assetMonetary: {
    findMany: async () => {
      return clone(getDb().assetMonetaries);
    },
    create: async (args: { data: Omit<AssetMonetary, "assetMonetaryId"> }) => {
      const db = getDb();
      const nextId = db.assetMonetaries.reduce((max, m) => Math.max(max, m.assetMonetaryId), 0) + 1;
      const newM = { ...args.data, assetMonetaryId: nextId };
      db.assetMonetaries.push(newM);
      saveDb(db);
      return newM;
    }
  }
};
