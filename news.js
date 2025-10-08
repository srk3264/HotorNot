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
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/rss.xml';

            const response = await fetch(rssUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items) {
                console.log('=== BBC RSS DEBUG INFO ===');
                console.log('Full first item:', JSON.stringify(data.items[0], null, 2));

                // Extract first 3 items with images and descriptions
                this.newsItems = data.items.slice(0, 3).map((item, index) => {
                    console.log(`\n--- Processing Item ${index + 1} ---`);
                    console.log('Title:', item.title);
                    console.log('Link:', item.link);
                    console.log('GUID:', item.guid);

                    const imageUrl = this.extractImageUrl(item.description) ||
                                   this.extractImageFromBBC(item) ||
                                   this.extractMediaFromBBC(item);

                    console.log('Final image URL:', imageUrl);

                    return {
                        title: item.title,
                        description: this.stripHtml(item.description).substring(0, 120) + '...',
                        image: imageUrl,
                        link: item.link,
                        pubDate: item.pubDate
                    };
                });

                console.log('\n=== FINAL PROCESSED ITEMS ===');
                console.log(JSON.stringify(this.newsItems, null, 2));
            } else {
                throw new Error('Failed to fetch RSS data');
            }
        } catch (error) {
            console.error('Error fetching BBC news:', error);
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

    extractImageFromBBC(item) {
        // Try BBC-specific patterns for media and description
        console.log('Trying BBC-specific extraction for:', item.title);

        // Pattern 4: Check for BBC media content in description
        if (item.description) {
            // BBC often embeds media URLs in description
            const mediaMatch = item.description.match(/<media:thumbnail[^>]+url="([^"]+)"/);
            if (mediaMatch) {
                console.log('Found BBC media thumbnail:', mediaMatch[1]);
                return mediaMatch[1];
            }

            // Pattern 5: Look for BBC image URLs in description
            const bbcImgMatch = item.description.match(/https:\/\/[^"]+\.jpg|https:\/\/[^"]+\.png|https:\/\/[^"]+\.jpeg/);
            if (bbcImgMatch) {
                console.log('Found BBC image URL in description:', bbcImgMatch[0]);
                return bbcImgMatch[0];
            }
        }

        // Pattern 6: Check for BBC enclosure
        if (item.enclosure && item.enclosure.url) {
            console.log('Found BBC enclosure:', item.enclosure.url);
            return item.enclosure.url;
        }

        console.log('No BBC-specific image found');
        return null;
    }

    extractMediaFromBBC(item) {
        console.log('Trying BBC media tag extraction...');
        console.log('Full item structure:', JSON.stringify(item, null, 2));

        // Pattern 7: Check for media field in RSS2JSON structure
        if (item.media && item.media.url) {
            console.log('Found item.media.url:', item.media.url);
            return item.media.url;
        }

        // Pattern 8: Check for enclosures array (RSS2JSON sometimes puts media here)
        if (item.enclosures && item.enclosures.length > 0) {
            for (let enclosure of item.enclosures) {
                if (enclosure.url && enclosure.url.includes('ichef.bbci.co.uk')) {
                    console.log('Found BBC image in enclosures:', enclosure.url);
                    return enclosure.url;
                }
            }
        }

        // Pattern 9: Check for thumbnail field
        if (item.thumbnail && item.thumbnail.url) {
            console.log('Found item.thumbnail.url:', item.thumbnail.url);
            return item.thumbnail.url;
        }

        // Pattern 10: Check for media:thumbnail in description (fallback)
        if (item.description) {
            const mediaThumbnailMatch = item.description.match(/<media:thumbnail[^>]+url="([^"]+)"/);
            if (mediaThumbnailMatch) {
                console.log('Found BBC media:thumbnail in description:', mediaThumbnailMatch[1]);
                return mediaThumbnailMatch[1];
            }
        }

        // Pattern 11: Check all string fields for iChef URLs
        for (let key in item) {
            if (typeof item[key] === 'string' && item[key].includes('ichef.bbci.co.uk')) {
                const urlMatch = item[key].match(/https:\/\/ichef\.bbci\.co\.uk\/[^"]*\.(jpg|jpeg|png|gif)/i);
                if (urlMatch) {
                    console.log(`Found BBC iChef URL in ${key}:`, urlMatch[0]);
                    return urlMatch[0];
                }
            }
        }

        console.log('No BBC media tag found in any field');
        return null;
    }

    extractImageFromNPRStructure(item) {
        console.log('Trying NPR structure extraction...');

        // Pattern 7: Check for content:encoded which might contain image data
        if (item.content && item.content.length > 0) {
            console.log('Found content field, length:', item.content.length);
            const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
            if (imgMatch) {
                console.log('Found image in content:', imgMatch[1]);
                return imgMatch[1];
            }
        }

        // Pattern 8: Try different NPR URL patterns
        if (item.link) {
            // Extract slug from NPR URL
            const slugMatch = item.link.match(/npr\.org\/(\d+\/\d+\/\d+\/[^\/]+)/);
            if (slugMatch) {
                const slug = slugMatch[1];
                const imageUrl = `https://media.npr.org/assets/img/2024/10/07/${slug}_wide.jpg`;
                console.log('Trying NPR slug pattern:', imageUrl);
                return imageUrl;
            }
        }

        // Pattern 9: Try direct media.npr.org construction
        if (item.guid) {
            const guidMatch = item.guid.match(/\/(\d+)$/);
            if (guidMatch) {
                const articleId = guidMatch[1];
                const imageUrl = `https://media.npr.org/assets/img/2024/10/07/${articleId}_wide.jpg`;
                console.log('Trying direct NPR media URL:', imageUrl);
                return imageUrl;
            }
        }

        // Pattern 10: Try thumbnail pattern
        if (item.link) {
            const nprMatch = item.link.match(/npr\.org\/(\d+)\//);
            if (nprMatch) {
                const articleId = nprMatch[1];
                const imageUrl = `https://media.npr.org/assets/img/2024/10/07/${articleId}_thumb.jpg`;
                console.log('Trying NPR thumbnail pattern:', imageUrl);
                return imageUrl;
            }
        }

        console.log('No NPR structure image found');
        return null;
    }

    showFallbackNews() {
        // Fallback news if RSS fails
        this.newsItems = [
            {
                title: "BBC News Feed Unavailable",
                description: "Unable to load latest news. Please check back later.",
                image: "https://via.placeholder.com/300x150?text=No+Image"
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
                     onerror="this.style.display='none'; console.log('Image failed to load for:', this.alt)">
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
