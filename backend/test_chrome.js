const http = require('http');

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log("Fetching Chrome debugging targets...");
    const targets = await getJson("http://127.0.0.1:9222/json");
    const target = targets.find(t => t.url.includes("127.0.0.1:3002") && t.webSocketDebuggerUrl);
    if (!target) {
        console.error("Could not find Sri Sapthagiri page target in Chrome. Targets found:", targets);
        return;
    }
    
    const wsUrl = target.webSocketDebuggerUrl;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    let id = 1;
    function send(method, params = {}) {
        const msgId = id++;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((resolve) => {
            const listener = (event) => {
                const res = JSON.parse(event.data);
                if (res.id === msgId) {
                    ws.removeEventListener('message', listener);
                    resolve(res.result);
                }
            };
            ws.addEventListener('message', listener);
        });
    }

    ws.onopen = async () => {
        console.log("Connected to Chrome Remote Debugger.");
        
        // Enable Console and Runtime
        await send("Console.enable");
        await send("Runtime.enable");
        
        ws.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.method === "Runtime.consoleAPICalled") {
                const args = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(" ");
                console.log(`[BROWSER CONSOLE] [${data.params.type}] ${args}`);
            }
            if (data.method === "Runtime.exceptionThrown") {
                console.error(`[BROWSER EXCEPTION]`, data.params.exceptionDetails);
            }
        });

        // 1. Perform Login
        console.log("Performing Admin Login...");
        await send("Runtime.evaluate", {
            expression: `
                (async () => {
                    document.getElementById('btn-admin-login').click();
                    document.getElementById('admin-password-input').value = '12345678';
                    document.getElementById('btn-admin-confirm').click();
                })()
            `
        });

        // Wait 2 seconds for state loading
        await new Promise(r => setTimeout(r, 2000));

        // 2. Open Add Pipe modal and attempt to submit
        console.log("Attempting to Add Pipe...");
        const result = await send("Runtime.evaluate", {
            expression: `
                (async () => {
                    // Open Modal
                    openAddPipeModal();
                    
                    // Fill form details
                    document.getElementById('pipeSizeInput').value = 'TEST-PIPE-AUTOGEN';
                    document.getElementById('pipeOpeningStock').value = '10';
                    
                    // Qty in godown allocation (first row is pre-added with value '0')
                    const godownQtyInput = document.querySelector('#pipeGodownAllocationsContainer .godown-qty');
                    if (godownQtyInput) {
                        godownQtyInput.value = '10';
                    }
                    
                    // Submit Form
                    let submitPromise = new Promise((resolve) => {
                        document.getElementById('pipeForm').addEventListener('submit', () => {
                            resolve("submitted form listener triggered");
                        }, { once: true });
                    });
                    
                    document.getElementById('pipeSubmitBtn').click();
                    return await submitPromise;
                })()
            `,
            awaitPromise: true
        });

        console.log("Add Pipe trigger result:", result);

        // Wait 2 seconds
        await new Promise(r => setTimeout(r, 2000));

        // 3. Open Add Fitting modal and attempt to submit
        console.log("Attempting to Add Fitting...");
        const result2 = await send("Runtime.evaluate", {
            expression: `
                (async () => {
                    // Switch view to Fittings
                    switchView('fittingsView');
                    
                    // Open Modal
                    openAddFittingModal();
                    
                    // Fill details
                    document.getElementById('fittingNameInput').value = 'TEST-FITTING-AUTOGEN';
                    document.getElementById('fittingLimit').value = '10';
                    document.getElementById('fittingOpeningStock').value = '15';
                    
                    const godownQtyInput = document.querySelector('#fittingGodownAllocationsContainer .godown-qty');
                    if (godownQtyInput) {
                        godownQtyInput.value = '15';
                    }
                    
                    // Submit Form
                    document.getElementById('fittingSubmitBtn').click();
                })()
            `,
            awaitPromise: true
        });
        
        console.log("Add Fitting trigger result:", result2);

        // Wait 3 seconds to see if errors appear
        await new Promise(r => setTimeout(r, 3000));
        
        ws.close();
        process.exit(0);
    };
}

run().catch(console.error);
