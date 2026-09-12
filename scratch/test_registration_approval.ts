async function runTest() {
  console.log("1. Submitting test registration request...");
  const testEmail = `test.student.${Date.now()}@dlsu.edu.ph`;
  const idNum = Math.floor(10000000 + Math.random() * 90000000);

  const regRes = await fetch("http://localhost:4000/api/auth/register-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Test",
      lastName: "Student",
      email: testEmail,
      idNumber: idNum,
      userType: "STUDENT",
      requestedRole: "Custodian",
      labAffiliation: "CITe4D",
      password: "password123"
    })
  });

  const regData: any = await regRes.json();
  console.log("Registration Response:", regData);

  if (!regData.success) {
    console.error("❌ Registration request failed!");
    return;
  }

  const requestId = regData.registration.id;
  console.log(`\n2. Fetching pending registrations... (ID: ${requestId})`);
  const listRes = await fetch("http://localhost:4000/api/auth/pending-registrations");
  const listData: any = await listRes.json();
  console.log(`Found ${listData.pendingRegistrations.length} pending registration(s).`);

  console.log("\n3. Simulating Lab Head approval...");
  const approveRes = await fetch("http://localhost:4000/api/auth/approve-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId })
  });

  const approveData: any = await approveRes.json();
  console.log("Approve Response:", approveData);

  if (approveData.success) {
    console.log("✅ SUCCESS! Account created in MySQL / Prisma Studio user account!");
  } else {
    console.error("❌ Approval failed:", approveData.error);
  }
}

runTest().catch(console.error);
