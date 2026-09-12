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
  profilePicture?: string;
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
  projectId?: string;
  projectName?: string;
  projectLeader?: string;
  ccsLab?: string;
  fundingAgency?: string;
  projectStartYear?: string;
  description?: string;
  image?: string;
  specs?: string;
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

export interface InspectionSchedule {
  scheduleId: number;
  labGroupId: string;
  inspectionDate: string;
  cycleType: "Annual" | "Trimestral";
  createdAt: string;
}

export interface MaintenanceQueueItem {
  id: string;
  asset: string;
  serial: string;
  lab: string;
  lastInspected: string;
  status: "Due Soon" | "Overdue" | "Scheduled" | "Inspected";
  urgency: "Low" | "Normal" | "High" | "Critical";
  labGroupId: string;
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
  inspectionSchedules: InspectionSchedule[];
  maintenanceQueue: MaintenanceQueueItem[];
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
    { userId: 10, firstName: "T.", lastName: "Lim", email: "t.lim@dlsu.edu.ph", password: "password123", idNumber: 10101010, userType: "FACULTY" },
    { userId: 11, firstName: "Dr. Elena", lastName: "Castro", email: "director@dlsu.edu.ph", password: "director_password", idNumber: 12121212, userType: "FACULTY" }
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
    { userRoleId: 5, userId: 7, roleId: 5 },
    { userRoleId: 6, userId: 11, roleId: 2 }
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
  assets: [],
  assetRecords: [],
  assetTags: [],
  assetMonetaries: [],
  transfers: [],
  disposals: [],
  repairs: [],
  inspectionSchedules: [],
  maintenanceQueue: []
};

// Database helper functions
function getDb(): DatabaseState {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    return seedData;
  }
  try {
    const db = JSON.parse(data) as DatabaseState;
    if (db && !db.inspectionSchedules) {
      db.inspectionSchedules = [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
    if (db && !db.maintenanceQueue) {
      db.maintenanceQueue = seedData.maintenanceQueue;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
    
    // Check if we need to reset/migrate localStorage data to introduce project fields
    if (db && db.assets && db.assets.length > 0 && !db.assets[0].hasOwnProperty("projectId")) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
      return seedData;
    }

    if (db && db.users && !db.users.some(u => u.email === "director@dlsu.edu.ph")) {
      db.users.push({ userId: 11, firstName: "Dr. Elena", lastName: "Castro", email: "director@dlsu.edu.ph", password: "director_password", idNumber: 12121212, userType: "FACULTY" });
      if (db.userRoles) {
        const nextUrId = db.userRoles.reduce((max, ur) => Math.max(max, ur.userRoleId), 0) + 1;
        db.userRoles.push({ userRoleId: nextUrId, userId: 11, roleId: 2 });
      }
      if (!db.assetTags || db.assetTags.length === 0) {
        db.assetTags = seedData.assetTags;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
    return db;
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
  },
  assetTag: {
    findMany: async () => {
      return clone(getDb().assetTags);
    },
    create: async (args: { data: Omit<AssetTag, "assetTagId"> }) => {
      const db = getDb();
      const nextId = db.assetTags.reduce((max, t) => Math.max(max, t.assetTagId), 0) + 1;
      const newTag = { ...args.data, assetTagId: nextId };
      db.assetTags.push(newTag);
      saveDb(db);
      return newTag;
    }
  },
  inspectionSchedule: {
    findMany: async () => {
      const db = getDb();
      return clone(db.inspectionSchedules || []);
    },
    create: async (args: { data: Omit<InspectionSchedule, "scheduleId"> }) => {
      const db = getDb();
      if (!db.inspectionSchedules) db.inspectionSchedules = [];
      const nextId = db.inspectionSchedules.reduce((max, s) => Math.max(max, s.scheduleId), 0) + 1;
      const newSched = { ...args.data, scheduleId: nextId };
      db.inspectionSchedules.push(newSched);
      saveDb(db);
      return newSched;
    },
    deleteMany: async () => {
      const db = getDb();
      db.inspectionSchedules = [];
      saveDb(db);
      return [];
    }
  },
  maintenanceQueue: {
    findMany: async () => {
      const db = getDb();
      return clone(db.maintenanceQueue || []);
    },
    update: async (args: { where: { id: string }, data: Partial<MaintenanceQueueItem> }) => {
      const db = getDb();
      db.maintenanceQueue = db.maintenanceQueue.map(item =>
        item.id === args.where.id ? { ...item, ...args.data } : item
      );
      saveDb(db);
      return clone(db.maintenanceQueue.find(item => item.id === args.where.id) || null);
    }
  }
};
