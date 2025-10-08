class NewsCarousel {
    constructor() {
        this.currentIndex = 0;
        this.newsItems = [];
        this.init();
    }

    async init() {
        await this.fetchNews();
        this.renderCarousel();
        this.setupEventListeners();
    }

    async fetchNews() {
        try {
            // Use RSS2JSON service to avoid CORS issues
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.npr.org/1001/rss.xml';

            const response = await fetch(rssUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items) {
                console.log('Raw RSS data:', data.items[0]); // Debug first item

                // Extract first 3 items with images and descriptions
                this.newsItems = data.items.slice(0, 3).map((item, index) => {
                    const imageUrl = this.extractImageUrl(item.description) ||
                                   this.extractImageFromNPR(item) ||
                                   `https://picsum.photos/300/150?random=${index}`;

                    return {
                        title: item.title,
                        description: this.stripHtml(item.description).substring(0, 120) + '...',
                        image: imageUrl,
                        link: item.link,
                        pubDate: item.pubDate
                    };
                });

                console.log('Processed NPR news items:', this.newsItems);
            } else {
                throw new Error('Failed to fetch RSS data');
            }
        } catch (error) {
            console.error('Error fetching NPR news:', error);
            this.showFallbackNews();
        }
    }

    stripHtml(html) {
        // Remove HTML tags from description
        return html.replace(/<[^>]*>/g, '');
    }

    extractImageUrl(description) {
        // Try multiple patterns for NPR images
        console.log('Looking for image in:', description.substring(0, 200) + '...');

        // Pattern 1: Standard img tag
        let imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) {
            console.log('Found image with pattern 1:', imgMatch[1]);
            return imgMatch[1];
        }

        // Pattern 2: NPR might use enclosure or media content
        imgMatch = description.match(/enclosure[^>]+url="([^"]+)"/);
        if (imgMatch) {
            console.log('Found image with pattern 2:', imgMatch[1]);
            return imgMatch[1];
        }

        // Pattern 3: Look for media:content
        imgMatch = description.match(/<media:content[^>]+url="([^"]+)"/);
        if (imgMatch) {
            console.log('Found image with pattern 3:', imgMatch[1]);
            return imgMatch[1];
        }

        console.log('No image found in description');
        return null;
    }

    extractImageFromNPR(item) {
        // Try NPR-specific patterns
        console.log('Trying NPR-specific extraction for:', item.title);

        // Pattern 4: Check if item has enclosure with image
        if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
            console.log('Found enclosure image:', item.enclosure.url);
            return item.enclosure.url;
        }

        // Pattern 5: Try to construct NPR image URL from guid or link
        if (item.guid) {
            // NPR often uses predictable image URL patterns
            const guidMatch = item.guid.match(/\/(\d+)\//);
            if (guidMatch) {
                const articleId = guidMatch[1];
                const constructedUrl = `https://media.npr.org/assets/img/2024/10/07/${articleId}_wide.jpg`;
                console.log('Constructed NPR image URL:', constructedUrl);
                return constructedUrl;
            }
        }

        // Pattern 6: Try to get image from NPR's oembed or API
        if (item.link) {
            // Extract article ID from NPR URL
            const nprMatch = item.link.match(/npr\.org\/(\d+)\//);
            if (nprMatch) {
                const articleId = nprMatch[1];
                const imageUrl = `https://media.npr.org/assets/img/2024/10/07/gettyimages-${articleId}_wide.jpg`;
                console.log('Trying NPR image pattern:', imageUrl);
                return imageUrl;
            }
        }

        console.log('No NPR-specific image found');
        return null;
    }

    showFallbackNews() {
        // Fallback news if RSS fails
        this.newsItems = [
            {
                title: "NPR News Feed Unavailable",
                description: "Unable to load latest news. Please check back later.",
                image: `https://picsum.photos/300/150?random=1`
            }
        ];
    }

    renderCarousel() {
        const track = document.querySelector('.carousel-track');
        if (!track) {
            console.warn('Carousel track not found');
            return;
        }

        track.innerHTML = '';

        this.newsItems.forEach((item, index) => {
            const newsElement = document.createElement('div');
            newsElement.className = 'news-item';
            newsElement.innerHTML = `
                <img src="${item.image}" alt="${item.title}" class="news-image"
                     onerror="this.src='https://picsum.photos/300/150?text=News'">
                <div class="news-content">
                    <h3 class="news-title">${item.title}</h3>
                    <p class="news-description">${item.description}</p>
                    <small class="news-date">${new Date(item.pubDate).toLocaleDateString()}</small>
                </div>
            `;
            track.appendChild(newsElement);
        });

        console.log(`Rendered ${this.newsItems.length} news items`);
    }

    setupEventListeners() {
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');

        if (prevBtn) prevBtn.onclick = () => this.previousSlide();
        if (nextBtn) nextBtn.onclick = () => this.nextSlide();
    }

    nextSlide() {
        if (this.currentIndex < this.newsItems.length - 1) {
            this.currentIndex++;
            this.updateCarousel();
        }
    }

    previousSlide() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateCarousel();
        }
    }

    updateCarousel() {
        const track = document.querySelector('.carousel-track');
        if (track) {
            const offset = this.currentIndex * 270; // 250px width + 20px gap
            track.style.transform = `translateX(-${offset}px)`;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.newsCarousel = new NewsCarousel();
});
