async function testApi() {
    try {
        const res = await fetch("http://localhost:4000/api/assets");
        const json = await res.json();
        console.log("API /api/assets response status:", res.status);
        console.log("API /api/assets response success:", json.success);
        if (json.assets) {
            console.log(`Returned ${json.assets.length} assets from remote DB! Sample asset[0]:`, json.assets[0]);
        } else {
            console.log("Response json:", json);
        }
    } catch (e) {
        console.error("API test error:", e);
    }
}
testApi();
