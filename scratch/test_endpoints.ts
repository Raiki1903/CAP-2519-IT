async function testEndpoints() {
    const urls = [
        "http://localhost:4000/api/analytics/advanced/funding-valuation",
        "http://localhost:4000/api/analytics/compliance",
        "http://localhost:4000/api/analytics/stakeholder/audit-discrepancies",
        "http://localhost:4000/api/analytics/advanced/project-allocation",
        "http://localhost:4000/api/analytics/advanced/idle-time",
        "http://localhost:4000/api/analytics/advanced/idle-frequency"
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            console.log(`\n=== URL: ${url} ===`);
            console.log(`Success: ${data.success}`);
            if (data.success) {
                console.log("Data sample:", JSON.stringify(data.data).slice(0, 300));
            } else {
                console.error("Error response:", data.error);
            }
        } catch (e: any) {
            console.error(`❌ Failed to fetch ${url}:`, e.message);
        }
    }
}

testEndpoints();
