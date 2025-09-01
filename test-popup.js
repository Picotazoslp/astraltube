// Test popup functionality
document.addEventListener('DOMContentLoaded', async () => {
    console.log('AstralTube Test Popup loaded');
    
    // Test components
    testComponents();
    
    // Test YouTube integration
    testYouTubeIntegration();
    
    // Test storage
    testStorage();
    
    // Setup button handlers
    setupButtonHandlers();
});

function testComponents() {
    const container = document.getElementById('components-test');
    const results = [];
    
    // Check if Chrome APIs are available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        results.push({
            status: 'success',
            message: 'Chrome Extension APIs available'
        });
    } else {
        results.push({
            status: 'error', 
            message: 'Chrome Extension APIs not available'
        });
    }
    
    // Check for service worker
    chrome.runtime.sendMessage({action: 'ping'}).then(response => {
        if (response && response.success) {
            results.push({
                status: 'success',
                message: 'Service worker responding'
            });
        } else {
            results.push({
                status: 'error',
                message: 'Service worker not responding'
            });
        }
        updateTestResults(container, results);
    }).catch(error => {
        results.push({
            status: 'error',
            message: 'Service worker connection failed: ' + error.message
        });
        updateTestResults(container, results);
    });
}

function testYouTubeIntegration() {
    const container = document.getElementById('youtube-test');
    const results = [];
    
    // Check if we can access YouTube tabs
    chrome.tabs.query({url: "https://*.youtube.com/*"}, (tabs) => {
        if (tabs && tabs.length > 0) {
            results.push({
                status: 'success',
                message: `Found ${tabs.length} YouTube tab(s)`
            });
        } else {
            results.push({
                status: 'pending',
                message: 'No YouTube tabs found'
            });
        }
        updateTestResults(container, results);
    });
}

function testStorage() {
    const container = document.getElementById('storage-test');
    const results = [];
    
    // Test chrome.storage
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({test: 'value'}).then(() => {
            return chrome.storage.local.get('test');
        }).then(result => {
            if (result.test === 'value') {
                results.push({
                    status: 'success',
                    message: 'Chrome storage working'
                });
                // Clean up
                chrome.storage.local.remove('test');
            } else {
                results.push({
                    status: 'error',
                    message: 'Chrome storage read failed'
                });
            }
            updateTestResults(container, results);
        }).catch(error => {
            results.push({
                status: 'error',
                message: 'Chrome storage error: ' + error.message
            });
            updateTestResults(container, results);
        });
    } else {
        results.push({
            status: 'error',
            message: 'Chrome storage API not available'
        });
        updateTestResults(container, results);
    }
}

function updateTestResults(container, results) {
    container.innerHTML = results.map(result => `
        <div class="test-result test-${result.status}">
            <span class="status-indicator status-${result.status}"></span>
            ${result.message}
        </div>
    `).join('');
}

function setupButtonHandlers() {
    document.getElementById('test-storage').addEventListener('click', () => {
        chrome.storage.local.get(null).then(data => {
            alert('Storage contents: ' + JSON.stringify(data, null, 2));
        }).catch(error => {
            alert('Storage error: ' + error.message);
        });
    });
    
    document.getElementById('test-youtube').addEventListener('click', () => {
        chrome.runtime.sendMessage({action: 'testYouTubeAPI'}).then(response => {
            alert('API Test: ' + (response ? JSON.stringify(response, null, 2) : 'No response'));
        }).catch(error => {
            alert('API Error: ' + error.message);
        });
    });
    
    document.getElementById('inject-sidebar').addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleSidebar'}).then(response => {
                    alert('Sidebar: ' + (response ? 'Toggled' : 'Failed'));
                }).catch(error => {
                    alert('Sidebar error: ' + error.message);
                });
            } else {
                alert('Please navigate to YouTube first');
            }
        });
    });
    
    document.getElementById('open-options').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
}