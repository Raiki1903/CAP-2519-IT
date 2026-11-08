/**
 * The demo history's story: six months of loans, maintenance, retirements, a missing asset and routine inspections,
 * plus remarks, support tickets, logins and clearance prints, dated back from the day the seed runs. The scripted events give each asset status its reason and make each insight
 * rule fire on 2 to 4 assets; the generated loans (a fixed random sequence, so every run writes the same story) fill
 * the weeks around them.
 * Layer: database tooling. Read by prisma/seed.ts. Calls prisma/seedSteps.ts and prisma/seedHistory.ts.
 * Used by: npm run seed.
 */
import type { Prisma, assets_category, assets_status, user_tickets_status, user_tickets_type } from "@prisma/client";
import { DEMO_ACCOUNTS, DEMO_IT_ADMIN_ID, DEMO_TSG_IDS, type DemoAccount } from "./seedData";
import { accountSteps, registrationSteps, SEEDED_ASSETS, type AccountDecision, type ActivityRow, type InspectionRow, type SeedClock, type SeededAsset } from "./seedHistory";
import { HistoryBuilder, type LoanRow, type RetirementRow, type TicketRow } from "./seedSteps";

const [TSG_A, TSG_B] = DEMO_TSG_IDS;
const DIRECTOR = 2;
const SECRETARY = 3;

/** Account ids by their role in the story. */
const HEAD = { CITe4D: 6, CAR: 7, CeHCI: 12, HXIL: 13, GAME: 14, CeLT: 15, Bio: 16, CNIS: 17, CIVI: 18, TE3D: 19 } as const;
const R = { a: 8, b: 9, c: 10, d: 20, e: 21, f: 22, g: 23, h: 24, i: 25, j: 26, k: 27 } as const;

/** Every dated row of the demo history, before ids. */
export interface SeedHistory {
  /** What the IT Admin's steps left on each account row, by user id. */
  decisions: Map<number, AccountDecision>;
  /** Each asset's status now, by asset id. */
  statuses: Map<number, assets_status>;
  inspections: InspectionRow[];
  loans: LoanRow[];
  tickets: TicketRow[];
  retirements: RetirementRow[];
  remarks: RemarkRow[];
  userTickets: UserTicketRow[];
  activity: ActivityRow[];
}

/**
 * The scripted events. Day numbers count back from the seed's day (negative: still to come). They give each status
 * its reason, and the insights their targets: LOAN-02 (GAME-0005, CNIS-0005), REP-03 (CNIS-0002 with a ticket still
 * open, TE3D-0001 with three resolved), COND-05 (CITe4D-0005 Critical Defect, GAME-0006, CNIS-0002). WAR-01 and LIFE-04
 * come from the assets' dates (seedData.ts).
 */
function scriptedEvents(b: HistoryBuilder): void {
  const t = b.clock.at;

  // On Loan: six held loans, two of them overdue (LOAN-02), one Return Requested.
  b.loan({
    tag: "CITe4D-0007", borrower: R.a, purpose: "Photos of the telehealth kiosk pilot sites for the progress report.", project: "CITE4D-2024-01",
    destRoom: "G404", requested: t(5, 10, 15), returnBy: -9, decided: { at: t(5, 14), approve: true }, released: { at: t(4, 10, 30), by: TSG_A },
  });
  b.loan({
    tag: "HXIL-0003", borrower: R.c, purpose: "Driving sessions for the driver fatigue study, participants 11 to 20.", project: "HXIL-2023-05",
    destRoom: "G406", requested: t(15, 9, 40), returnBy: -16, decided: { at: t(14, 11), approve: true }, released: { at: t(13, 13), by: TSG_B },
  });
  b.loan({
    tag: "GAME-0005", borrower: R.f, purpose: "Playtesting the flood evacuation game with Grade 10 students.", project: "GAME-2023-02",
    requested: t(26, 10), returnBy: 10, decided: { at: t(25, 9, 30), approve: true }, released: { at: t(24, 14), by: TSG_A },
  });
  b.loan({
    tag: "CNIS-0005", borrower: R.e, purpose: "Gateway node for the air quality sensors on the rooftop.", project: "CNIS-2024-02",
    requested: t(42, 13), returnBy: 20, decided: { at: t(41, 10), approve: true }, released: { at: t(40, 11), by: TSG_B },
  });
  b.loan({
    tag: "TE3D-0004", borrower: R.j, purpose: "Backing up the workshop footage before editing.", project: "TE3D-2024-01",
    requested: t(12, 9), returnBy: -2, decided: { at: t(12, 15), approve: true }, released: { at: t(11, 10), by: TSG_A },
    returnRequested: { at: t(1, 16, 20), remarks: "Done with the backup. I can bring it back tomorrow." },
  });
  b.loan({
    tag: "CAR-0001", borrower: R.b, purpose: "Second screen for labeling the sorting arm camera data.", project: "CAR-2024-03",
    destLab: "CITe4D", destRoom: "G407", requested: t(8, 11), returnBy: -20, decided: { at: t(7, 9, 15), approve: true }, released: { at: t(7, 14, 30), by: TSG_B },
  });

  // Missing: lost on a field test; the loan ends by loss.
  const lost = b.loan({
    tag: "CITe4D-0002", borrower: R.b, purpose: "Camera for the kiosk field test at a partner barangay health center.", project: "CITE4D-2024-01",
    requested: t(48, 10), returnBy: 32, decided: { at: t(47, 9), approve: true }, released: { at: t(46, 10), by: TSG_A },
  });
  b.markMissing(lost, t(30, 15), TSG_A, "Borrower reports it was lost during the field test. Not found at the health center or in G407.");

  // Maintenance, Inspecting: the holder reports a fault, and receiving the asset ends the loan (COND-05).
  const questLoan = b.loan({
    tag: "GAME-0006", borrower: R.g, purpose: "VR walkthrough of the evacuation route for the youth workshop.", project: "GAME-2023-02",
    requested: t(14, 10), returnBy: -5, decided: { at: t(13, 9, 30), approve: true }, released: { at: t(12, 10), by: TSG_B },
  });
  b.ticket({
    tag: "GAME-0006", reporter: R.g, type: "BORROWER_REPORT", issue: "OTHER", reported: t(3, 16), endsLoan: questLoan,
    description: "The left controller loses tracking and the headset keeps showing a guardian error.",
    received: { at: t(2, 10, 30), by: TSG_A, finding: { condition: "DEGRADED", remarks: "Left controller tracking ring cracked; tracking drops every few minutes." } },
  });

  // Maintenance, External Service: a workstation under warranty goes to the warranty holder. A routine inspection had
  // already found the fan noise, so the receipt is no worse than the inspection before it.
  b.routine(b.asset("GAME-0007"), t(30, 10), TSG_B, { condition: "MINOR_DRIFT", remarks: "Fans loud under GPU load. Dust cleared; the noise stays.", metrics: { CPU_LOAD_TEMP: 76 } });
  b.ticket({
    tag: "GAME-0007", reporter: HEAD.GAME, type: "BORROWER_REPORT", issue: "OTHER", reported: t(8, 9),
    description: "The workstation restarts by itself when a render uses the GPU.",
    received: { at: t(6, 10), by: TSG_B, finding: { condition: "MINOR_DRIFT", remarks: "Restarts under a GPU stress test; fans loud.", metrics: { CPU_LOAD_TEMP: 81 } } },
    stage: { stage: "EXTERNAL_SERVICE", provider: "HP Philippines authorized service center (warranty)" },
  });

  // Maintenance, Repairing: the third ticket in six months on one router (REP-03 HIGH, COND-05).
  b.ticket({
    tag: "CNIS-0002", reporter: HEAD.CNIS, type: "BORROWER_REPORT", issue: "NETWORK_PORTS", reported: t(150, 10),
    description: "The 5 GHz network drops every few minutes during the sensor tests.",
    received: { at: t(149, 9, 30), by: TSG_A, finding: { condition: "MINOR_DRIFT", remarks: "5 GHz radio drops under load.", metrics: { PACKET_LOSS: 3.8 } } },
    completed: { at: t(146, 15), by: TSG_A, outcome: "RESOLVED", remarks: "Updated RouterOS and reset the radio settings.", finding: { condition: "OPERATIONAL", remarks: "Two-hour load test with no drops." } },
  });
  b.ticket({
    tag: "CNIS-0002", reporter: TSG_B, type: "TSG_MAINTENANCE", issue: "NETWORK_PORTS", reported: t(80, 9),
    description: "High packet loss on ether2 during a check.",
    received: { at: t(80, 9, 30), by: TSG_B, finding: { condition: "MINOR_DRIFT", remarks: "ether2 drops packets; the port light flickers.", metrics: { PACKET_LOSS: 2.6, WORKING_PORTS: 4 } } },
    stage: { stage: "REPAIRING" },
    completed: { at: t(77, 14), by: TSG_B, outcome: "RESOLVED", remarks: "Reseated the ether2 jack and replaced the patch cable.", finding: { condition: "OPERATIONAL", remarks: "All 5 ports pass.", metrics: { WORKING_PORTS: 5, PACKET_LOSS: 0.2 } } },
  });
  b.ticket({
    tag: "CNIS-0002", reporter: HEAD.CNIS, type: "BORROWER_REPORT", issue: "NETWORK_PORTS", reported: t(7, 11),
    description: "The 5 GHz network is dropping again, now several times an hour.",
    received: { at: t(6, 9), by: TSG_A, finding: { condition: "MINOR_DRIFT", remarks: "5 GHz radio drops again: the third time this term.", metrics: { PACKET_LOSS: 4.1 } } },
    stage: { stage: "REPAIRING" },
  });

  // REP-03 MEDIUM: a printer repaired three times, all resolved; TSG asks to retire it and the Director denies it.
  b.ticket({
    tag: "TE3D-0001", reporter: HEAD.TE3D, type: "BORROWER_REPORT", issue: "OTHER", reported: t(160, 10),
    description: "Paper jams on every second page.",
    received: { at: t(159, 9), by: TSG_B, finding: { condition: "MINOR_DRIFT", remarks: "Feed roller worn; jams on plain paper." } },
    completed: { at: t(158, 15), by: TSG_B, outcome: "RESOLVED", remarks: "Cleaned the feed rollers and the paper path.", finding: { condition: "OPERATIONAL", remarks: "Printed 50 pages with no jam." } },
  });
  b.ticket({
    tag: "TE3D-0001", reporter: TSG_A, type: "TSG_MAINTENANCE", issue: "OTHER", reported: t(100, 9),
    description: "Print head clogged; streaks on every page.",
    received: { at: t(100, 9, 20), by: TSG_A, finding: { condition: "DEGRADED", remarks: "Black and cyan nozzles clogged; the nozzle check fails." } },
    stage: { stage: "REPAIRING" },
    completed: { at: t(97, 16), by: TSG_A, outcome: "RESOLVED", remarks: "Ran two power cleanings and refilled the black ink.", finding: { condition: "OPERATIONAL", remarks: "Nozzle check passes." } },
  });
  b.ticket({
    tag: "TE3D-0001", reporter: HEAD.TE3D, type: "BORROWER_REPORT", issue: "OTHER", reported: t(52, 10),
    description: "Streaks again on the workshop handouts.",
    received: { at: t(51, 9), by: TSG_B, finding: { condition: "DEGRADED", remarks: "Cyan nozzles clogged again." } },
    completed: { at: t(48, 15), by: TSG_B, outcome: "RESOLVED", remarks: "Power cleaning; the cyan line is clear again.", finding: { condition: "OPERATIONAL", remarks: "Nozzle check passes." } },
  });
  b.retirement({
    tag: "TE3D-0001", requestedBy: TSG_B, requested: t(45, 10), previousStatus: "AVAILABLE",
    reason: "Third repair in four months for the same clogging. Retire the asset and buy a laser printer.",
    decided: { at: t(43, 14), by: DIRECTOR, approve: false, remarks: "The repairs cost little and it prints well now. Keep it until the print head fails for good." },
  });

  // A resolved display fault reported by a Lab Head.
  b.ticket({
    tag: "CeHCI-0001", reporter: HEAD.CeHCI, type: "BORROWER_REPORT", issue: "DISPLAY", reported: t(124, 10),
    description: "HDMI 2 shows no signal from the lab laptop.",
    received: { at: t(123, 9, 30), by: TSG_A, finding: { condition: "MINOR_DRIFT", remarks: "HDMI 2 dead; HDMI 1 and 3 work." } },
    completed: { at: t(121, 14), by: TSG_A, outcome: "RESOLVED", remarks: "Reseated the HDMI board connector.", finding: { condition: "OPERATIONAL", remarks: "All three inputs show a picture." } },
  });

  // Retired from Maintenance: Beyond Repair, then a retirement the Director approves and TSG completes.
  b.ticket({
    tag: "HXIL-0004", reporter: HEAD.HXIL, type: "BORROWER_REPORT", issue: "OTHER", reported: t(74, 10),
    description: "No force feedback: the wheel turns freely and makes a grinding sound.",
    received: { at: t(73, 9), by: TSG_A, finding: { condition: "DEGRADED", remarks: "No force feedback; the motor grinds.", metrics: { MOTOR_SPEED: 1650 } } },
    stage: { stage: "REPAIRING" },
    completed: {
      at: t(70, 15), by: TSG_A, outcome: "BEYOND_REPAIR", remarks: "The force feedback motor is burnt and the part is no longer sold.",
      finding: { condition: "CRITICAL_DEFECT", remarks: "The motor does not turn under power.", metrics: { MOTOR_SPEED: 0 } },
    },
  });
  b.retirement({
    tag: "HXIL-0004", requestedBy: TSG_A, requested: t(69, 10), previousStatus: "MAINTENANCE", pathway: "RECYCLE",
    reason: "The maintenance ticket ended Beyond Repair: the force feedback motor is burnt and no spare part is sold.",
    decided: { at: t(67, 11), by: DIRECTOR, approve: true, remarks: "Approved. Recycle it through the university's e-waste partner." },
    completed: { at: t(63, 14), by: TSG_B, pathway: "RECYCLE", reference: "DEMO-DISP-0001" },
  });

  // Retired from Available: an old workstation donated.
  b.retirement({
    tag: "CeLT-0002", requestedBy: TSG_B, requested: t(58, 10), previousStatus: "AVAILABLE", pathway: "DONATE",
    reason: "Past its useful life (bought in 2018) and too slow for the lab's work. It still powers on.",
    assessment: { condition: "MINOR_DRIFT", remarks: "Works, but slow; fans loud.", metrics: { CPU_LOAD_TEMP: 74 } },
    decided: { at: t(56, 11), by: SECRETARY, approve: true, remarks: "Approved for donation to a partner public school." },
    completed: { at: t(50, 14), by: TSG_A, pathway: "DONATE", reference: "DEMO-DISP-0002" },
  });

  // Pending Retirement, with a Critical Defect assessment (COND-05 HIGH).
  b.retirement({
    tag: "CITe4D-0005", requestedBy: TSG_A, requested: t(2, 14), previousStatus: "AVAILABLE", pathway: "RECYCLE",
    reason: "The lamp failed and the main board no longer powers on. A new lamp and board cost more than a new projector.",
    assessment: { condition: "CRITICAL_DEFECT", remarks: "Does not power on; the lamp is burnt." },
  });

  // Return Damage: TSG finds damage at the return and opens the ticket in the same step.
  b.loan({
    tag: "CITe4D-0006", borrower: R.a, purpose: "Recording interviews with rural health workers.", project: "CITE4D-2024-01",
    requested: t(66, 10), returnBy: 55, decided: { at: t(66, 14), approve: true }, released: { at: t(64, 10), by: TSG_A },
    returnRequested: { at: t(56, 15), remarks: "The record button sticks since yesterday." },
    received: {
      at: t(55, 10), by: TSG_B, finding: { condition: "DEGRADED", remarks: "Casing cracked near the record button; the button sticks." },
      damage: {
        issue: "PHYSICAL_DAMAGE", description: "Cracked casing; the record button sticks.", stage: { stage: "REPAIRING" },
        completed: { at: t(49, 15), by: TSG_B, outcome: "RESOLVED", remarks: "Replaced the button and glued the casing.", finding: { condition: "OPERATIONAL", remarks: "Records and plays back normally." } },
      },
    },
  });

  // Ended by Maintenance, then resolved: the holder reports crackling during a loan.
  const audioLoan = b.loan({
    tag: "TE3D-0006", borrower: R.j, purpose: "Recording narration for the youth workshop videos.", project: "TE3D-2024-01",
    requested: t(118, 10), returnBy: 102, decided: { at: t(118, 15), approve: true }, released: { at: t(116, 10), by: TSG_A },
  });
  b.ticket({
    tag: "TE3D-0006", reporter: R.j, type: "BORROWER_REPORT", issue: "OTHER", reported: t(110, 13), endsLoan: audioLoan,
    description: "Crackling on input 1 when the gain is above half.",
    received: { at: t(109, 10), by: TSG_B, finding: { condition: "MINOR_DRIFT", remarks: "Input 1 crackles at high gain." } },
    stage: { stage: "REPAIRING" },
    completed: { at: t(103, 15), by: TSG_B, outcome: "RESOLVED", remarks: "Cleaned the gain knob and resoldered the input 1 jack.", finding: { condition: "OPERATIONAL", remarks: "Both inputs are clean at full gain." } },
  });

  // A ticket the reporting Lab Head cancels before TSG receives the asset.
  b.ticket({
    tag: "CIVI-0003", reporter: HEAD.CIVI, type: "BORROWER_REPORT", issue: "DISPLAY", reported: t(33, 10),
    description: "No display output after the lab moved desks.",
    cancelled: { at: t(33, 11, 30), by: HEAD.CIVI, remarks: "The monitor cable was loose. It works now." },
  });

  // Requests still waiting: two Pending Approval, one Pending Release.
  b.loan({ tag: "HXIL-0002", borrower: R.i, purpose: "Running the eye-tracking software for the fatigue study pilot.", project: "HXIL-2023-05", requested: t(1, 15, 10), returnBy: -14 });
  b.loan({ tag: "CeHCI-0002", borrower: R.d, purpose: "Training the facial expression model for the online learners study.", project: "CEHCI-2024-04", requested: t(2, 10, 45), returnBy: -21 });
  b.loan({
    tag: "CNIS-0004", borrower: R.e, purpose: "Calibrating the air quality sensors before the next deployment.", project: "CNIS-2024-02",
    requested: t(3, 9, 30), returnBy: -12, decided: { at: t(2, 11), approve: true, remarks: "Approved. Pick it up from TSG." },
  });

  // Declined and cancelled requests.
  b.loan({ tag: "GAME-0004", borrower: R.f, purpose: "Weekend playtest at home.", requested: t(95, 10), returnBy: 92, decided: { at: t(94, 9), approve: false, remarks: "Booked for the GAME Lab open house that week." } });
  b.loan({ tag: "CeLT-0001", borrower: R.d, purpose: "Showing the speech demo at a class.", requested: t(140, 11), returnBy: 138, decided: { at: t(139, 10), approve: false, remarks: "The TV stays mounted in G409. Book the room for the demo instead." } });
  b.loan({ tag: "HXIL-0005", borrower: R.i, purpose: "Setting up a second driving station.", requested: t(40, 10), returnBy: 30, decided: { at: t(40, 16), approve: false, remarks: "Needed for the driving study sessions this month." } });
  b.loan({ tag: "CNIS-0001", borrower: R.h, destLab: "CIVI", purpose: "Showing the image dataset at a lab meeting.", requested: t(60, 9), returnBy: 58, decided: { at: t(59, 14), approve: false, remarks: "Ask CNIS to set up the TV in G403 for the meeting instead." } });
  b.loan({ tag: "TE3D-0008", borrower: R.g, purpose: "Recording a class demonstration.", requested: t(130, 10), returnBy: 125, cancelled: t(130, 15) });
  b.loan({ tag: "CAR-0004", borrower: R.b, purpose: "Mapping test for the sorting arm cell.", project: "CAR-2024-03", requested: t(90, 10), returnBy: 84, decided: { at: t(89, 10), approve: true }, cancelled: t(88, 9) });
  b.loan({ tag: "CIVI-0001", borrower: R.h, purpose: "Color grading the dataset previews.", requested: t(20, 10), returnBy: 13, cancelled: t(19, 9) });
}

/** Released and returned generated loans per week, oldest week first; the last is this week. Three busier weeks. */
const LOANS_PER_WEEK = [3, 3, 4, 4, 3, 2, 4, 6, 4, 3, 4, 5, 4, 3, 3, 6, 4, 3, 4, 3, 5, 6, 4, 3, 3, 2];

/** How often each category is borrowed, compared with the others: mounted TVs and the network gear seldom. */
const BORROW_WEIGHT: Partial<Record<assets_category, number>> = { TV: 0.3, SWITCH: 0.3, PRINTER: 0.3, ROUTER: 0.6, VR: 1.6, CAMERA: 1.4, DEV_KIT: 1.3, TABLET: 1.3 };

/** What a loan of each category is for. */
const PURPOSES: Record<assets_category, string[]> = {
  CAMERA: ["Photos for the field visit report.", "Documenting the prototype for a paper.", "Covering the lab's research forum."],
  VIDEO_CAMERA: ["Recording the workshop sessions.", "Video interviews for the study."],
  TV: ["Presentation at the CCS research colloquium.", "Showing the demo at the department open house."],
  MONITOR: ["Second screen for data labeling.", "Extra screen for a thesis defense rehearsal."],
  CPU: ["Training a model over the weekend.", "Running the simulation batch for a paper."],
  DEV_KIT: ["Prototype build for the sensor study.", "Testing firmware on the field kit.", "Robotics demo for the open house."],
  TABLET: ["Sketching game levels.", "Drawing the storyboard for the workshop video.", "Annotating images for the dataset."],
  VR: ["VR user study sessions.", "Playtesting the VR prototype."],
  PROJECTOR: ["Workshop at a partner school.", "Seminar presentation in the AVR."],
  RECORDER: ["Recording interviews for the study.", "Recording focus group discussions."],
  ROUTER: ["Isolated network for a security lab exercise.", "Network for the field test."],
  SWITCH: ["Wiring the cluster for a network experiment."],
  SIMULATOR: ["Driving study sessions.", "Pilot runs of the simulator study."],
  PRINTER: ["Printing workshop handouts."],
  HARD_DRIVE: ["Backing up the study recordings.", "Moving the dataset to the training PC."],
  AUDIO: ["Recording podcast episodes for the outreach project.", "Voice-over for the workshop video."],
  SPEAKER: ["Sound for the workshop activity.", "Audio for the outreach event."],
  MEMORY_CARD: ["Storage for the field camera."],
  KEYBOARD: ["Spare keyboard for the study station."],
  MOUSE: ["Spare mouse for the study station."],
};

/** What a borrower writes when asking to return, when they write anything. */
const RETURN_REMARKS = ["Done earlier than planned.", "Returning it with all the accessories.", "Finished the sessions."];

/** A fixed random sequence (mulberry32), so every run writes the same story. */
function randomFrom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** The personal Researcher accounts: no Head, approved, never rejected or pending. */
const BORROWERS = DEMO_ACCOUNTS.filter((a) => a.role === "RESEARCHER" && !a.heads && a.decidedDaysAgo !== null);

/** The borrower's labs at that moment (before a LABS_CHANGED step, the labs it was approved with). */
function labsAt(clock: SeedClock, account: DemoAccount, at: Date): string[] {
  if (account.approvedLabs && account.labsChangedDaysAgo !== undefined && at < clock.at(account.labsChangedDaysAgo, 14, 5)) return account.approvedLabs;
  return account.labs;
}

/**
 * The day the account must be cleared by: an account the IT Admin deactivated had its clearance record printed the day
 * before, with every loan closed. Null when the account is still Active.
 */
export function clearedByDaysAgo(account: DemoAccount): number | null {
  return account.deactivatedDaysAgo !== undefined ? account.deactivatedDaysAgo + 1 : null;
}

/** Whether the account may borrow from `from` to `to`: approved before, and cleared before any deactivation. */
function canBorrow(clock: SeedClock, account: DemoAccount, from: Date, to: Date): boolean {
  if (from <= clock.at(account.decidedDaysAgo!, 12)) return false;
  const clearedBy = clearedByDaysAgo(account);
  return clearedBy === null || to < clock.at(clearedBy, 9);
}

/**
 * Fills each week with returned loans, on assets that are free, by borrowers who may borrow then, decided by the
 * Head of the asset's lab at that time. Most borrowers are members of the asset's lab; the destination is always one of
 * the borrower's labs.
 */
function generatedLoans(b: HistoryBuilder): void {
  const random = randomFrom(176);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  const between = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));
  const t = b.clock.at;
  const weekday = t(0, 12).getDay();
  const thisMonday = (weekday + 6) % 7;

  LOANS_PER_WEEK.forEach((target, week) => {
    const monday = thisMonday + (LOANS_PER_WEEK.length - 1 - week) * 7;
    let placed = 0;
    for (let tries = 0; placed < target && tries < 200; tries++) {
      const released = monday - between(0, 4);
      const length = pick([2, 3, 4, 5, 7, 7, 10, 14]);
      const returnBy = released - length;
      const closed = returnBy + pick([1, 0, 0, 0, -1, -2]);
      if (closed < 1 || closed >= released) continue;
      const requestedDay = released + between(1, 3);
      const decidedDay = between(released, requestedDay);
      const requestHour = between(8, 14);
      const requested = t(requestedDay, requestHour, between(0, 59));
      const decidedHour = decidedDay === requestedDay ? Math.min(requestHour + 2, 17) : between(8, 12);
      const decided = t(decidedDay, decidedHour, between(0, 59));
      const releasedAt = t(released, released === decidedDay ? Math.min(decidedHour + 2, 18) : between(9, 15), between(0, 59));
      const receivedAt = t(closed, between(13, 17), between(0, 59));

      const candidates = SEEDED_ASSETS.filter((a) => b.headAt(a.lab, decided) !== null && b.isFree(a, requested, receivedAt));
      if (candidates.length === 0) continue;
      const weights = candidates.map((a) => BORROW_WEIGHT[a.category] ?? 1);
      let roll = random() * weights.reduce((sum, w) => sum + w, 0);
      const asset = candidates.find((_, i) => (roll -= weights[i]) < 0) ?? candidates[candidates.length - 1];

      const able = BORROWERS.filter((a) => canBorrow(b.clock, a, requested, receivedAt));
      const members = able.filter((a) => labsAt(b.clock, a, requested).includes(asset.lab));
      const borrower = members.length > 0 && random() < 0.85 ? pick(members) : able.length > 0 ? pick(able) : null;
      if (!borrower) continue;
      const borrowerLabs = labsAt(b.clock, borrower, requested);
      const member = borrowerLabs.includes(asset.lab);
      const asks = random() < 0.6;

      b.loan({
        tag: asset.tag, borrower: borrower.userId, purpose: pick(PURPOSES[asset.category]),
        project: member && asset.project && random() < 0.7 ? asset.project : undefined,
        destLab: member ? asset.lab : borrowerLabs[0], requested, returnBy,
        decided: { at: decided, approve: true }, released: { at: releasedAt, by: pick(DEMO_TSG_IDS) },
        returnRequested: asks ? { at: t(closed, between(8, 11), between(0, 59)), remarks: random() < 0.5 ? pick(RETURN_REMARKS) : null } : undefined,
        received: { at: receivedAt, by: pick(DEMO_TSG_IDS) },
      });
      placed += 1;
    }
  });
}

/**
 * TSG's routine rounds, one lab group at a time (shared/constants/inspectionGroups.ts): each Available asset of the
 * group that is at home and was not inspected in the 25 days before. The second round of each group covers every other
 * asset only, so the routine queue (90 days) shows some assets due and some done.
 */
function routineRounds(b: HistoryBuilder): void {
  const rounds: { labs: string[]; daysAgo: number; half: boolean; by: number }[] = [
    { labs: ["CITe4D", "CAR", "CNIS"], daysAgo: 150, half: false, by: TSG_A },
    { labs: ["CeHCI", "CeLT", "TE3D"], daysAgo: 140, half: false, by: TSG_B },
    { labs: ["GAME", "Bio"], daysAgo: 128, half: false, by: TSG_A },
    { labs: ["CIVI", "HXIL"], daysAgo: 118, half: false, by: TSG_B },
    { labs: ["CIVI", "HXIL"], daysAgo: 75, half: true, by: TSG_A },
    { labs: ["CITe4D", "CAR", "CNIS"], daysAgo: 62, half: true, by: TSG_B },
    { labs: ["CeHCI", "CeLT", "TE3D"], daysAgo: 47, half: true, by: TSG_A },
    { labs: ["GAME", "Bio"], daysAgo: 38, half: true, by: TSG_B },
  ];
  for (const round of rounds) {
    const group = SEEDED_ASSETS.filter((a) => round.labs.includes(a.lab));
    let n = 0;
    group.forEach((asset, i) => {
      if (round.half && i % 2 === 1) return;
      const at = b.clock.at(round.daysAgo, 9 + Math.floor((n * 15) / 60), 30 + ((n * 15) % 30));
      const last = b.lastTsgInspection(asset, at);
      if (!b.isFree(asset, at, new Date(at.getTime() + 60 * 60 * 1000))) return;
      if (last && at.getTime() - last.getTime() < 25 * 24 * 60 * 60 * 1000) return;
      b.routine(asset, at, round.by);
      n += 1;
    });
  }
}

/** A remark on an asset before its id (remarks.repository.ts). A deleted one keeps its row. */
export interface RemarkRow {
  tag: string;
  author_id: number;
  remark_text: string;
  created_at: Date;
  deleted_by_id: number | null;
  deleted_at: Date | null;
}

/**
 * Remarks by the people allowed to write them (contract 7.2): TSG, the Director, the Secretary, and the Head of the
 * asset's home lab on its own lab's assets. One was deleted by its author: the row stays, with who and when.
 */
function remarks(clock: SeedClock): RemarkRow[] {
  const t = clock.at;
  const remark = (tag: string, author: number, at: Date, text: string): RemarkRow => ({
    tag, author_id: author, remark_text: text, created_at: at, deleted_by_id: null, deleted_at: null,
  });
  return [
    remark("CITe4D-0004", TSG_B, t(170, 11), "Wall-mounted in G407. Lend it only for events, with the stand from the TSG office."),
    remark("CIVI-0001", HEAD.CIVI, t(100, 14), "Calibrated for color work. Please do not change the picture settings."),
    remark("GAME-0004", HEAD.GAME, t(90, 10), "Factory reset after each loan. Do not sign in with a personal Meta account."),
    remark("HXIL-0003", HEAD.HXIL, t(60, 9), "Reserved for the driver fatigue study sessions on Tuesdays and Thursdays."),
    { ...remark("CAR-0002", TSG_A, t(50, 10), "Calibrated with the sorting arm camera. Keep it on the left station."), deleted_by_id: TSG_A, deleted_at: t(50, 10, 5) },
    remark("TE3D-0001", SECRETARY, t(42, 15), "Retirement denied. Ink refills come from the TE3D supplies budget."),
    remark("CITe4D-0002", TSG_A, t(29, 10), "A search of G407 and the health center found nothing. Reported to the CCS office."),
    remark("CeLT-0003", DIRECTOR, t(20, 16), "Include this asset in the replacement request for the next fiscal year."),
    remark("Bio-0002", HEAD.Bio, t(15, 13), "For the protein structure demo. Ask the Lab Head before installing packages."),
    remark("CNIS-0002", TSG_A, t(6, 14), "Third ticket for the 5 GHz radio this term. If it fails again, TSG will request its retirement."),
    remark("GAME-0007", TSG_B, t(5, 9), "With the HP service center under warranty since TSG received it."),
  ];
}

/** A support ticket with its id, which the activity rows quote. */
export type UserTicketRow = Prisma.user_ticketsCreateManyInput & { ticket_id: number; created_at: Date; updated_at: Date };

/**
 * Support tickets of every type and status (tickets.repository.ts), oldest first, and the TICKET_STATUS_CHANGED row of
 * each status change: the IT Admin as actor, the ticket's creator as target, details `#<id> <from> to <to>`. A ticket
 * closed as Resolved or Rejected has its remarks, resolver and time.
 */
function supportTickets(clock: SeedClock): { tickets: UserTicketRow[]; activity: ActivityRow[] } {
  const t = clock.at;
  const plans: {
    by: number; type: user_tickets_type; title: string; description: string; at: Date;
    moves: { to: user_tickets_status; at: Date; remarks?: string }[];
  }[] = [
    {
      by: R.k, type: "ACCOUNT_ACCESS", title: "Please add me to the Bioinformatics Lab", at: t(70, 15),
      description: "I am joining the Bio lab's protein structure project this term. Please add Bio to my labs.",
      moves: [{ to: "IN_PROGRESS", at: t(69, 10) }, { to: "RESOLVED", at: t(68, 14, 10), remarks: "Added Bio to your labs." }],
    },
    {
      by: HEAD.TE3D, type: "QUESTION", title: "Who can see the remarks on an asset?", at: t(58, 11),
      description: "Can researchers read the remarks we add on our lab's assets?",
      moves: [{ to: "RESOLVED", at: t(57, 9, 30), remarks: "Every logged-in account can read them. Only TSG, the Director, the Secretary and the lab's Head can add them." }],
    },
    {
      by: R.f, type: "BUG", title: "Cannot request the Quest 2", at: t(45, 16),
      description: "The request button says the asset already has a request, but nobody is using it.",
      moves: [{ to: "REJECTED", at: t(44, 10), remarks: "Not a bug: another request was waiting for that asset. Request it again once it is free." }],
    },
    {
      by: R.c, type: "ACCOUNT_ACCESS", title: "Locked out after too many tries", at: t(26, 9, 20),
      description: "I typed my password wrong several times and the login page told me to wait.",
      moves: [{ to: "IN_PROGRESS", at: t(26, 9, 40) }, { to: "RESOLVED", at: t(26, 10), remarks: "The block clears after 15 minutes. You can log in again now." }],
    },
    {
      by: SECRETARY, type: "OTHER", title: "Add a funding source", at: t(16, 14),
      description: "Please add DOST-ASTI to the funding source list for a new project.",
      moves: [{ to: "IN_PROGRESS", at: t(15, 9) }],
    },
    {
      by: TSG_A, type: "BUG", title: "Bell count stays after a release", at: t(9, 11),
      description: "After I release a loan, the bell still shows it until I reload the page.",
      moves: [{ to: "IN_PROGRESS", at: t(8, 10) }],
    },
    {
      by: R.e, type: "QUESTION", title: "How do I extend my return-by date?", at: t(4, 13),
      description: "My sensor test runs longer than planned. Can I change the return-by date of my loan?",
      moves: [],
    },
    {
      by: R.a, type: "BUG", title: "Asset photo does not load on my phone", at: t(1, 20),
      description: "The asset photo stays blank in my phone's browser. It works on my laptop.",
      moves: [],
    },
  ];
  const tickets: UserTicketRow[] = [];
  const activity: ActivityRow[] = [];
  plans.forEach((plan, i) => {
    const ticketId = i + 1;
    let status: user_tickets_status = "OPEN";
    const row: UserTicketRow = {
      ticket_id: ticketId, created_by_id: plan.by, type: plan.type, title: plan.title, description: plan.description,
      status, created_at: plan.at, updated_at: plan.at,
    };
    for (const move of plan.moves) {
      activity.push({
        actor_id: DEMO_IT_ADMIN_ID, event_type: "TICKET_STATUS_CHANGED", target_user_id: plan.by,
        details: `#${ticketId} ${status} to ${move.to}`, created_at: move.at,
      });
      status = move.to;
      Object.assign(row, { status, updated_at: move.at });
      if (move.remarks) Object.assign(row, { resolution_remarks: move.remarks, resolved_by_id: DEMO_IT_ADMIN_ID, resolved_at: move.at });
    }
    tickets.push(row);
  });
  return { tickets, activity };
}

/**
 * Logins (auth.service.ts login) and clearance prints (loans.repository.ts). A success has the account as actor; a
 * failure has no actor, the account as target, and only the reason as details, never the typed email. A deactivated
 * account had its clearance record printed by TSG the day before.
 */
function loginsAndClearances(clock: SeedClock): ActivityRow[] {
  const t = clock.at;
  const rows: ActivityRow[] = [];
  const success = (userId: number, at: Date) => rows.push({ actor_id: userId, event_type: "LOGIN_SUCCESS", created_at: at });
  const failure = (userId: number, at: Date, reason: string) =>
    rows.push({ actor_id: null, event_type: "LOGIN_FAILURE", target_user_id: userId, details: reason, created_at: at });

  for (const a of DEMO_ACCOUNTS.filter((x) => x.status === "ACTIVE")) {
    for (let k = 0; k < 3; k++) success(a.userId, t(1 + ((a.userId * 5 + k * 7) % 21), 8 + ((a.userId + k) % 9), (a.userId * 13) % 60));
  }
  success(R.a, t(0, 8, 5));
  success(DEMO_IT_ADMIN_ID, t(0, 8, 30));
  for (let k = 0; k < 5; k++) failure(R.c, t(26, 8, 50 + k), "Wrong password");
  success(R.c, t(26, 9, 15));
  failure(R.e, t(12, 19, 2), "Wrong password");
  failure(11, t(5, 10, 41), "Account pending");
  failure(30, t(14, 13, 7), "Account rejected");

  for (const a of DEMO_ACCOUNTS.filter((x) => x.deactivatedDaysAgo !== undefined)) {
    success(a.userId, t(a.deactivatedDaysAgo! + 5, 9, 12));
    rows.push({ actor_id: TSG_A, event_type: "CLEARANCE_RECORD_PRINTED", target_user_id: a.userId, created_at: t(clearedByDaysAgo(a)!, 10) });
    if (a.anonymizedDaysAgo === undefined) failure(a.userId, t(10, 9, 3), "Account inactive");
  }
  return rows;
}

/** Builds the whole demo history for a seed run on the clock's day. */
export function buildHistory(clock: SeedClock): SeedHistory {
  const accounts = accountSteps(clock);
  const registration = registrationSteps(clock);
  const b = new HistoryBuilder(clock, registration.inspections);
  scriptedEvents(b);
  generatedLoans(b);
  routineRounds(b);
  const statuses = b.settle();
  const support = supportTickets(clock);
  return {
    decisions: accounts.decisions,
    statuses,
    inspections: b.inspections,
    loans: b.loans,
    tickets: b.tickets,
    retirements: b.retirements,
    remarks: remarks(clock),
    userTickets: support.tickets,
    activity: [...accounts.activity, ...registration.activity, ...b.activity, ...support.activity, ...loginsAndClearances(clock)],
  };
}
