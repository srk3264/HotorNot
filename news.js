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
                // Extract first 3 items with images and descriptions
                this.newsItems = data.items.slice(0, 3).map(item => ({
                    title: item.title,
                    description: this.stripHtml(item.description).substring(0, 120) + '...',
                    image: this.extractImageUrl(item.description) || 'https://via.placeholder.com/300x150?text=NPR+News',
                    link: item.link,
                    pubDate: item.pubDate
                }));

                console.log('Fetched NPR news items:', this.newsItems);
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
        // Extract image URL from NPR's description HTML
        const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
        return imgMatch ? imgMatch[1] : null;
    }

    showFallbackNews() {
        // Fallback news if RSS fails
        this.newsItems = [
            {
                title: "NPR News Feed Unavailable",
                description: "Unable to load latest news. Please check back later.",
                image: "https://via.placeholder.com/300x150?text=NPR+News"
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
                     onerror="this.src='https://via.placeholder.com/300x150?text=NPR+News'">
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
