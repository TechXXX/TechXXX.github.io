// ==UserScript==
// @name         Magnet Link to Real-Debrid Adjusted
// @namespace    http://tampermonkey.net/
// @version      1.X
// @description  Automatically send magnet links to Real-Debrid, check for duplicates, and select specific file types
// @author       Pahiro - Updated by Bas
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      api.real-debrid.com
// ==/UserScript==

(function() {
    'use strict';

    const apiKey = 'XXXXXXXXX'; // Replace with your Real-Debrid API key
    const allowedExtensions = ['mp3', 'm4b', 'mp4', 'mkv', 'cbz', 'cbr', 'pdf'];

    let existingTorrents = [];

    // Function to get the hash from a magnet link
    function getMagnetHash(magnetLink) {
        const magnetUri = new URL(magnetLink);
        const hashParam = magnetUri.searchParams.get('xt');
        return hashParam ? hashParam.split(':').pop().toUpperCase() : null;
    }

    // Function to fetch the list of existing torrents from Real-Debrid
    function fetchExistingTorrents() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://api.real-debrid.com/rest/1.0/torrents',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                onload: function(response) {
                    try {
                        existingTorrents = JSON.parse(response.responseText);
                        console.log('Fetched existing torrents:', existingTorrents);
                        resolve();
                    } catch (error) {
                        console.error('Error parsing existing torrents:', error);
                        reject(error);
                    }
                },
                onerror: function(error) {
                    console.error('Error fetching torrents from Real-Debrid:', error);
                    reject(error);
                }
            });
        });
    }

    // Function to check if a torrent already exists in Real-Debrid
    function isTorrentInList(magnetHash) {
        return existingTorrents.some(torrent => torrent.hash.toUpperCase() === magnetHash);
    }

    function sendToRealDebrid(magnetLink, icon) {
        const magnetHash = getMagnetHash(magnetLink);

        if (!magnetHash) {
            showTemporaryMessage('Invalid magnet link.', 'red');
            return;
        }

        if (isTorrentInList(magnetHash)) {
            showTemporaryMessage('Torrent already exists in Real-Debrid.', 'red');
            icon.style.filter = 'hue-rotate(0deg)';
            return;
        }

        // Step 1: Add the magnet link to Real-Debrid
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: `magnet=${encodeURIComponent(magnetLink)}`,
            onload: function(addMagnetResponse) {
                try {
                    const addMagnetData = JSON.parse(addMagnetResponse.responseText);
                    const torrentId = addMagnetData.id;

                    // Step 2: Retrieve the list of files in the torrent
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
                        headers: {
                            'Authorization': `Bearer ${apiKey}`
                        },
                        onload: function(torrentInfoResponse) {
                            const torrentInfoData = JSON.parse(torrentInfoResponse.responseText);
                            const files = torrentInfoData.files;

                            // Step 3: Filter the files by specific extensions
                            const selectedFiles = files
                                .filter(file => allowedExtensions.includes(file.path.split('.').pop().toLowerCase()))
                                .map(file => file.id)
                                .join(',');

                            // Step 4: Select the filtered files in the torrent
                            if (selectedFiles.length > 0) {
                                GM_xmlhttpRequest({
                                    method: 'POST',
                                    url: `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
                                    headers: {
                                        'Authorization': `Bearer ${apiKey}`,
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                    },
                                    data: `files=${selectedFiles}`,
                                    onload: function() {
                                        showTemporaryMessage('Magnet link added and files selected in Real-Debrid!', 'green');
                                        icon.style.filter = 'invert(18%) sepia(88%) saturate(7485%) hue-rotate(357deg) brightness(103%) contrast(105%)';
                                    }
                                });
                            } else {
                                showTemporaryMessage('No files matched the selected extensions.', 'red');
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error processing addMagnet response:', error);
                    showTemporaryMessage('Failed to send magnet link to Real-Debrid.', 'red');
                }
            },
            onerror: function(error) {
                console.error('Error adding magnet link to Real-Debrid:', error);
                showTemporaryMessage('Failed to send magnet link to Real-Debrid.', 'red');
            }
        });
    }

    // Function to show a temporary message
    function showTemporaryMessage(message, color) {
        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.style.position = 'fixed';
        msgDiv.style.bottom = '20px';
        msgDiv.style.left = '20px';
        msgDiv.style.backgroundColor = color;
        msgDiv.style.color = 'white';
        msgDiv.style.padding = '10px';
        msgDiv.style.borderRadius = '5px';
        msgDiv.style.zIndex = 10000;
        document.body.appendChild(msgDiv);

        // Automatically remove the message after 3 seconds
        setTimeout(() => {
            msgDiv.remove();
        }, 3000);
    }

    // Function to create a send icon next to the magnet link
    function createSendIcon(link) {
        const icon = document.createElement('img');
        icon.src = 'https://fcdn.real-debrid.com/0830/favicons/favicon.ico'; // Real-Debrid icon
        icon.style.cursor = 'pointer';
        icon.style.marginLeft = '5px';
        icon.style.width = '16px';
        icon.style.height = '16px';

        icon.addEventListener('click', () => {
            sendToRealDebrid(link.href, icon);
        });

        link.parentNode.insertBefore(icon, link.nextSibling);
    }

    async function main() {
        const magnetLinks = document.querySelectorAll('a[href*="magnet:"]');
        if (magnetLinks.length > 0) {
            await fetchExistingTorrents();
            magnetLinks.forEach(createSendIcon);
        } else {
            console.log('No magnet links found on the page.');
        }
    }

    main(); // Call the main function
})();