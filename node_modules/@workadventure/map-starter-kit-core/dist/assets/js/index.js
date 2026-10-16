import Mustache from 'https://cdn.jsdelivr.net/npm/mustache@4.2.0/+esm';

// Function to retrieve the list of maps from the API
async function getMapsList() {
    try {
        const response = await fetch('/maps/list');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const maps = await response.json();
        return maps;
    } catch (error) {
        console.error('Error fetching maps list:', error);
        return [];
    }
}

// Function to get the list
async function getImagesList() {
    try {
        const response = await fetch('/images/list');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const images = await response.json();
        return images;
    } catch (error) {
        console.error('Error fetching images list:', error);
        return [];
    }
}

// Function to create a background image fade for "bg" element
async function createBackgroundImageFade(images = null) {
    // Get the list of images
    if (images === null) {
        const maps = await getMapsList();
        images = maps.map(map => {
            if (map.mapImage) {
                return map.mapImage.startsWith('http') ? map.mapImage : `/${map.mapImage}`;
            }
            return null;
        }).filter(img => img !== null);
        if (images.length === 0) {
            return;
        }
    }

    // Get the "bg" element
    const bgElement = document.querySelector('.bg');
    if (!bgElement || images.length === 0) return;

    // Create divs for each image with fade animation
    bgElement.innerHTML = '';
    images.forEach((imageUrl, index) => {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'bg-image' + (index === 0 ? ' active' : '');
        imgDiv.style.backgroundImage = `url('${imageUrl}')`;
        bgElement.appendChild(imgDiv);
    });

    // Automatic fade between images
    let currentIndex = 0;
    setInterval(() => {
        const imageElements = bgElement.querySelectorAll('.bg-image');
        if (imageElements.length === 0) return;

        // Remove the active class from the current image
        imageElements[currentIndex].classList.remove('active');

        // Move to the next image
        currentIndex = (currentIndex + 1) % imageElements.length;

        // Add the active class to the new image
        imageElements[currentIndex].classList.add('active');
    }, 5000); // Change image every 5 seconds
}

// Mustache template for a map card (rendered in loadTMJ)
const CARD_TEMPLATE = `
    <div class="map-cover" style="background-image: url('{{mapImageUrl}}');"></div>
    <div class="map-date">
        Last edit: {{lastModifiedFormatted}}
    </div>
    <div class="map-name">
        {{mapName}}
    </div>
    <div class="map-detail">
        <div class="map-file">
            <strong>{{filename}}</strong>.tmj
        </div>
        <div class="map-weight">
            <strong>{{size}}</strong>
            <span style="opacity: .5">Mo</span>
        </div>
    </div>
    <div class="map-desc">
        {{mapDescription}}
    </div>
    <div class="map-testurl">
        <a href="#" class="btn" data-map-path="{{path}}">Test my map</a>
    </div>
`;

// Load maps from API and render map cards with Mustache
async function loadTMJ() {
    try {
        const maps = await getMapsList();

        const mapImages = maps
            .map((map) => {
                if (map.mapImage) {
                    return map.mapImage.startsWith('http') ? map.mapImage : `/${map.mapImage}`;
                }
                return null;
            })
            .filter((img) => img !== null);

        if (mapImages.length > 0) {
            await createBackgroundImageFade(mapImages);
        }

        const defaultPlaceholder = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1620" height="1024"><rect fill="%231b2a41" width="100%" height="100%"/></svg>';
        const mapsData = maps.map((map) => {
            const mapImageUrl = map.mapImage
                ? (map.mapImage.startsWith('http') ? map.mapImage : `/${map.mapImage}`)
                : (mapImages.length > 0 ? mapImages[0] : defaultPlaceholder);
            return {
                ...map,
                mapImageUrl,
                mapDescription: map.mapDescription || 'No description available',
            };
        });

        const mainElement = document.querySelector('main');
        if (!mainElement) return;

        mainElement.innerHTML = '';
        mapsData.forEach((map) => {
            const section = document.createElement('section');
            section.className = 'card-map';
            section.innerHTML = Mustache.render(CARD_TEMPLATE, map);

            const testBtn = section.querySelector('.map-testurl a');
            if (testBtn) {
                testBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const host = window.location.host;
                    let path = window.location.pathname;
                    if (path.endsWith('index.html')) {
                        path = path.slice(0, -'index.html'.length);
                    }
                    const instanceId = Math.random().toString(36).substring(2, 15);
                    const url = `https://play.workadventu.re/_/${instanceId}/${host}${path}${map.path}`;
                    window.open(url, '_blank');
                });
            }
            mainElement.appendChild(section);
        });
    } catch (error) {
        console.error('Error loading maps:', error);
    }
}

async function setupPublishingActions() {
    const publishButton = document.getElementById('publishNowButton');
    if (!publishButton) return;
    const isInitiallyEnabled = !publishButton.disabled;

    publishButton.addEventListener('click', async () => {
        if (publishButton.disabled) {
            return;
        }
        const defaultLabel = publishButton.textContent;
        publishButton.disabled = true;
        publishButton.setAttribute('aria-disabled', 'true');
        publishButton.setAttribute('aria-busy', 'true');
        publishButton.textContent = 'Publishing...';
        const startTime = Date.now();
        const minDuration = 2000;
        const mapStorageInput = document.getElementById('mapStorageURL');
        const mapStorageUrl = mapStorageInput && 'value' in mapStorageInput
            ? mapStorageInput.value
            : '';

        if (typeof window.showLoadingOverlay === 'function') {
            window.showLoadingOverlay('Publishing your map...');
        }

        try {
            const response = await fetch('/uploader/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || 'Failed to publish maps. Please try again.';
                throw new Error(errorMessage);
            }

            const elapsed = Date.now() - startTime;
            if (elapsed < minDuration) {
                await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
            }

            const redirectUrl = typeof window.getPostPublishRedirect === 'function'
                ? window.getPostPublishRedirect(mapStorageUrl)
                : '/step4-validated';
            window.location.href = redirectUrl;
        } catch (error) {
            console.error('Error publishing maps:', error);
            if (typeof window.hideLoadingOverlay === 'function') {
                window.hideLoadingOverlay();
            }
            const errorMessage = error instanceof Error ? error.message : 'An error occurred while publishing maps.';
            if (typeof window.showErrorPopup === 'function') {
                window.showErrorPopup(errorMessage);
            } else {
                window.alert(errorMessage);
            }
            publishButton.textContent = defaultLabel;
            publishButton.removeAttribute('aria-busy');
            publishButton.disabled = !isInitiallyEnabled;
            publishButton.setAttribute('aria-disabled', String(!isInitiallyEnabled));
        }
    });
}

export { getMapsList, getImagesList, createBackgroundImageFade, loadTMJ, setupPublishingActions };
