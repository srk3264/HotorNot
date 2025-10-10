// Post Management
class PostManager {
    constructor() {
        this.posts = [];
        this.isAnonymous = false; // Track anonymous state
        this.postFormSetup = false; // Flag to prevent duplicate form setup
        this.init();
    }

    async init() {
        // Wait for supabase to be available
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase client not loaded yet');
            setTimeout(() => this.init(), 100);
            return;
        }

        // Set up authentication state handling
        this.setupAuthStateHandling();

        if (authManager.currentUser) {
            this.showMainContent();
            this.loadPosts();
        } else {
            this.hideMainContent();
        }

        // Set up post form (only when logged in)
        if (authManager.currentUser) {
            this.setupPostForm();
        }
    }

    setupAuthStateHandling() {
        // Listen for auth changes
        window.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session?.user ? 'logged in' : 'logged out');

            if (session?.user) {
                this.showMainContent();
                this.loadPosts();
                // Only setup form if not already set up
                if (!this.postFormSetup) {
                    console.log('Setting up post form after login');
                    this.setupPostForm();
                } else {
                    console.log('Post form already set up, skipping');
                }
            } else {
                this.hideMainContent();
                this.clearPosts();
            }
        });
    }

    showMainContent() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        // Clear existing content
        mainContent.innerHTML = '';

        // Create posts feed section
        const postsFeedSection = document.createElement('section');
        postsFeedSection.id = 'posts-feed';
        postsFeedSection.innerHTML = `
            <h2>Latest Hot Takes</h2>
            <div id="posts-container">
                <!-- Posts will be loaded here -->
            </div>
        `;

        // Create post form section
        const createPostSection = document.createElement('section');
        createPostSection.id = 'create-post';
        createPostSection.innerHTML = `
            <form id="post-form">
                <div class="input-group">
                    <input type="text" id="post-title" placeholder="Enter a bold title..." maxlength="200" required>
                    <div class="char-counter">0/200</div>
                </div>

                <div class="input-group">
                    <textarea id="post-content" placeholder="Explain your hot take..." maxlength="1000" required></textarea>
                    <div class="char-counter">0/1000</div>
                </div>

                <div class="form-actions">
                    <div class="anonymous-toggle" onclick="toggleAnonymous()">
                        <div class="toggle-track">
                            <div class="toggle-thumb"></div>
                        </div>
                        <span class="toggle-label">Anonymous</span>
                    </div>
                    <button type="submit" class="share-btn">
                        Share Take →
                    </button>
                </div>
            </form>
        `;

        // Append sections to main content
        mainContent.appendChild(createPostSection);
        mainContent.appendChild(postsFeedSection);

        // Set up the post form now that it exists in DOM
        this.setupPostForm();
    }

    hideMainContent() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '';
        }
    }

    setupPostForm() {
        // Reset flag each time to ensure fresh setup
        this.postFormSetup = false;

        const postForm = document.getElementById('post-form');
        if (!postForm) {
            console.warn('Post form not found, retrying...');
            // Retry after a short delay in case DOM isn't ready
            setTimeout(() => this.setupPostForm(), 100);
            return;
        }

        const postTitle = document.getElementById('post-title');
        const postContent = document.getElementById('post-content');

        if (!postTitle || !postContent) {
            console.warn('Post form elements not found, retrying...');
            setTimeout(() => this.setupPostForm(), 100);
            return;
        }

        // Character counters
        const titleCounter = document.querySelector('#post-title + .char-counter');
        const contentCounter = document.querySelector('#post-content + .char-counter');

        if (!titleCounter || !contentCounter) {
            console.warn('Character counters not found, retrying...');
            setTimeout(() => this.setupPostForm(), 100);
            return;
        }

        // Update character counters
        postTitle.addEventListener('input', () => {
            titleCounter.textContent = `${postTitle.value.length}/200`;
        });

        postContent.addEventListener('input', () => {
            contentCounter.textContent = `${postContent.value.length}/1000`;
        });

        // Prevent multiple rapid submissions with enhanced protection
        let isSubmitting = false;
        let lastSubmissionTime = 0;
        const MIN_SUBMISSION_INTERVAL = 1000; // Minimum 1 second between submissions

        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const now = Date.now();
            const timeSinceLastSubmission = now - lastSubmissionTime;

            // Enhanced protection against rapid submissions
            if (isSubmitting) {
                console.log('Form submission already in progress, ignoring...');
                this.showMessage('Please wait, post is being submitted...', 'error');
                return;
            }

            if (timeSinceLastSubmission < MIN_SUBMISSION_INTERVAL) {
                console.log('Submission too rapid, ignoring...');
                this.showMessage('Please wait a moment before submitting again...', 'error');
                return;
            }

            const title = postTitle.value.trim();
            const content = postContent.value.trim();

            if (!title || !content) {
                this.showMessage('Please enter both title and content!', 'error');
                return;
            }

            isSubmitting = true;
            lastSubmissionTime = now;
            console.log('Starting form submission...', {
                titleLength: title.length,
                contentLength: content.length,
                isAnonymous: this.isAnonymous,
                timestamp: new Date().toISOString()
            });

            // Disable form during submission
            postForm.style.opacity = '0.7';
            postForm.style.pointerEvents = 'none';

            const fullContent = `${title}\n\n${content}`;
            const result = await this.createPost(fullContent, this.isAnonymous);

            if (result.success) {
                postTitle.value = '';
                postContent.value = '';
                titleCounter.textContent = '0/200';
                contentCounter.textContent = '0/1000';
                // Reset toggle to off after successful post
                this.isAnonymous = false;
                this.updateToggleUI();
                this.showMessage('Hot take posted successfully!', 'success');
                this.loadPosts(); // Reload posts to show the new one
                console.log('Form submission completed successfully');
            } else {
                this.showMessage(result.message, 'error');
                console.log('Form submission failed:', result.message);
            }

            // Re-enable form after submission
            isSubmitting = false;
            postForm.style.opacity = '1';
            postForm.style.pointerEvents = 'auto';
        });

        this.postFormSetup = true;
        console.log('Post form setup completed successfully');
    }

    async createPost(content, isAnonymous) {
        try {
            // Get current display name and profile picture from user_profiles
            let authorDisplayName = null;
            let authorProfilePictureUrl = null;

            if (!isAnonymous) {
                const { data: profile, error: profileError } = await window.supabase
                    .from('user_profiles')
                    .select('display_name, profile_picture_url')
                    .eq('user_id', authManager.currentUser.id)
                    .single();

                if (profile?.display_name) {
                    authorDisplayName = profile.display_name;
                } else {
                    // Fallback to email prefix if profile doesn't exist
                    authorDisplayName = authManager.currentUser.email.split('@')[0];
                }

                authorProfilePictureUrl = profile?.profile_picture_url || null;
            }

            const { data, error } = await window.supabase
                .from('posts')
                .insert([
                    {
                        content: content,
                        author_id: authManager.currentUser.id,
                        author_display_name: authorDisplayName,
                        author_profile_picture_url: authorProfilePictureUrl,
                        is_anonymous: isAnonymous
                    }
                ])
                .select();

            if (error) throw error;

            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async loadPosts() {
        try {
            const { data, error } = await window.supabase
                .from('posts')
                .select(`
                    id,
                    content,
                    is_anonymous,
                    author_display_name,
                    created_at,
                    author_id,
                    author_profile_picture_url
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.posts = data || [];
            await this.loadLikesForPosts();

            // Ensure current user has a profile
            if (authManager.currentUser) {
                await this.ensureUserProfile();
            }

            this.displayPosts();
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showMessage('Error loading posts', 'error');
        }
    }

    async loadLikesForPosts() {
        try {
            // Get all likes for current user's posts
            const { data: likesData, error } = await window.supabase
                .from('likes')
                .select('post_id, like_type, user_id');

            if (error) throw error;

            // Group likes by post_id
            this.likesData = {};
            likesData?.forEach(like => {
                if (!this.likesData[like.post_id]) {
                    this.likesData[like.post_id] = { likes: 0, dislikes: 0, userLike: null };
                }
                if (like.like_type === 'like') {
                    this.likesData[like.post_id].likes++;
                } else {
                    this.likesData[like.post_id].dislikes++;
                }
                if (like.user_id === authManager.currentUser?.id) {
                    this.likesData[like.post_id].userLike = like.like_type;
                }
            });
        } catch (error) {
            console.error('Error loading likes:', error);
        }
    }

    async loadUserProfilesForPosts() {
        try {
            // Get all user profiles for post authors
            const { data: profilesData, error } = await window.supabase
                .from('user_profiles')
                .select('user_id, display_name');

            if (error) throw error;

            // Create a lookup map for user profiles
            this.userProfilesData = {};
            profilesData?.forEach(profile => {
                this.userProfilesData[profile.user_id] = profile;
            });
        } catch (error) {
            console.error('Error loading user profiles:', error);
        }
    }

    async ensureUserProfile() {
        try {
            // Check if current user has a profile
            const { data: profile, error } = await window.supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', authManager.currentUser.id)
                .single();

            if (error && (error.code === 'PGRST116' || error.message.includes('No rows found'))) {
                // Profile doesn't exist, create it with email prefix as default
                const emailPrefix = authManager.currentUser.email.split('@')[0];
                console.log('Creating default profile for user:', authManager.currentUser.id);

                const { error: createError } = await window.supabase
                    .from('user_profiles')
                    .insert([
                        {
                            user_id: authManager.currentUser.id,
                            display_name: emailPrefix
                        }
                    ]);

                if (createError) {
                    console.error('Error creating default profile:', createError);
                } else {
                    console.log('Default profile created successfully');
                }
            }
        } catch (error) {
            console.error('Error ensuring user profile:', error);
        }
    }

    async displayPosts() {
        const container = document.getElementById('posts-container');

        if (this.posts.length === 0) {
            container.innerHTML = '<p>No hot takes yet. Be the first to share your unpopular opinion!</p>';
            return;
        }

        let content = [];

        // Process posts in groups of 3, inserting news after each group
        for (let i = 0; i < this.posts.length; i += 3) {
            const group = this.posts.slice(i, i + 3);
            content.push(...group.map(post => this.createPostElement(post)));

            // Add news item after every 3 posts (except after the last group)
            if (i + 3 < this.posts.length) {
                const newsItem = await this.getNewsItem();
                if (newsItem) {
                    content.push(this.createNewsElement(newsItem));
                }
            }
        }

        container.innerHTML = content.join('');
    }

    async getNewsItem() {
        try {
            // Use RSS2JSON service to avoid CORS issues
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.npr.org/1001/rss.xml';

            const response = await fetch(rssUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items && data.items.length > 0) {
                // Initialize news index if not exists
                if (!this.newsIndex) {
                    this.newsIndex = 0;
                }

                // Get next news item in sequence
                const item = data.items[this.newsIndex % data.items.length];

                // Move to next item for next call
                this.newsIndex++;

                // Extract image and description from content:encoded field
                let imageUrl = null;
                let description = '';

                // Check for content:encoded field (NPR puts images here)
                if (item.content && item.content.length > 0) {
                    console.log('Found content field, length:', item.content.length);

                    // Extract first img src from content
                    const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
                    if (imgMatch) {
                        imageUrl = imgMatch[1];
                        console.log('Found image in content:', imageUrl);
                    }

                    // Extract first paragraph from content
                    const firstPMatch = item.content.match(/<p[^>]*>([^<]+)<\/p>/);
                    if (firstPMatch) {
                        description = firstPMatch[1];
                        console.log('Found first paragraph:', description);
                    }
                }

                // Fallback to description if content:encoded doesn't have paragraph
                if (!description && item.description) {
                    description = this.stripHtml(item.description).substring(0, 120) + '...';
                }

                // Fallback to placeholder if no image found
                if (!imageUrl) {
                    imageUrl = "https://picsum.photos/300/150?text=NPR+News";
                }

                return {
                    title: item.title,
                    description: description || 'No description available',
                    image: imageUrl,
                    link: item.link,
                    pubDate: item.pubDate
                };
            }
        } catch (error) {
            console.error('Error fetching news item:', error);
        }

        return null;
    }

    createNewsElement(newsItem) {
        if (!newsItem) return '';

        return `
            <div class="news-item-card">
                <div class="news-label">News for inspo</div>
                <img src="${newsItem.image}" alt="${newsItem.title}" class="news-image"
                     onerror="this.src='https://picsum.photos/300/150?text=NPR+News'; console.log('News image failed to load for:', this.alt)">
                <div class="news-content">
                    <div class="news-title">${this.escapeHtml(newsItem.title)}</div>
                    <p class="news-description">${this.escapeHtml(newsItem.description)}</p>
                    <small class="news-date">${new Date(newsItem.pubDate).toLocaleDateString()}</small>
                </div>
            </div>
        `;
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    createPostElement(post) {
        const date = new Date(post.created_at).toLocaleDateString();

        // Get display name from stored author_display_name or fallback
        let authorText = 'Anonymous';
        if (!post.is_anonymous) {
            if (post.author_display_name) {
                authorText = post.author_display_name;
            } else {
                authorText = 'User';
            }
        }

        const canEdit = !post.is_anonymous && post.author_id === authManager.currentUser?.id;

        const likesData = this.likesData[post.id] || { likes: 0, dislikes: 0, userLike: null };
        const { likes, dislikes, userLike } = likesData;

        // Create a title from the first line of content
        const contentLines = post.content.split('\n');
        const title = contentLines[0]?.substring(0, 50) + (contentLines[0]?.length > 50 ? '...' : '') || 'Untitled';
        const description = contentLines.slice(1).join('\n') || '';

        return `
            <div class="post-card" data-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar">
                        ${post.is_anonymous ?
                            `<div class="avatar-circle anonymous-avatar"></div>` :
                            (post.author_profile_picture_url ?
                                `<img src="${post.author_profile_picture_url}" alt="${authorText}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">` :
                                `<div class="avatar-circle">${authorText.charAt(0).toUpperCase()}</div>`
                            )
                        }
                    </div>
                    <div class="post-user-info">
                        <span class="post-username ${!post.is_anonymous ? 'clickable-username' : ''}" ${!post.is_anonymous ? `onclick="viewUserProfile('${post.author_id}')" style="cursor: pointer;"` : ''}>${authorText}</span>
                    </div>
                </div>
                <div class="post-main">
                    <h3 class="post-title">${this.escapeHtml(title)}</h3>
                    ${description ? `<p class="post-description">${this.escapeHtml(description)}</p>` : ''}
                    <div class="post-interactions">
                        <div class="like-section">
                            <button class="like-btn ${userLike === 'like' ? 'active' : ''}" onclick="postManager.likePost('${post.id}', 'like')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                                    <path d="M7 10v12"/>
                                    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>
                                </svg>
                                <span>${likes}</span>
                            </button>
                            <button class="dislike-btn ${userLike === 'dislike' ? 'active' : ''}" onclick="postManager.likePost('${post.id}', 'dislike')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                                    <path d="M17 14V2"/>
                                    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>
                                </svg>
                                <span>${dislikes}</span>
                            </button>
                        </div>
                    </div>
                </div>
                ${canEdit ? `
                    <div class="post-menu">
                        <button class="menu-btn" onclick="postManager.togglePostMenu('${post.id}')">⋯</button>
                        <div class="post-dropdown" id="dropdown-${post.id}" style="display: none;">
                            <button onclick="postManager.editPost('${post.id}')">Edit</button>
                            <button onclick="postManager.deletePost('${post.id}')">Delete</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async likePost(postId, likeType) {
        if (!authManager.currentUser) {
            this.showMessage('Please log in to like posts', 'error');
            return;
        }

        try {
            // Check if user already liked/disliked this post
            const { data: existingLike, error: fetchError } = await window.supabase
                .from('likes')
                .select('*')
                .eq('post_id', postId)
                .eq('user_id', authManager.currentUser.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw fetchError;
            }

            if (existingLike) {
                if (existingLike.like_type === likeType) {
                    // User clicked the same button - remove the like/dislike
                    const { error: deleteError } = await window.supabase
                        .from('likes')
                        .delete()
                        .eq('id', existingLike.id);

                    if (deleteError) throw deleteError;
                } else {
                    // User changed their vote
                    const { error: updateError } = await window.supabase
                        .from('likes')
                        .update({ like_type: likeType })
                        .eq('id', existingLike.id);

                    if (updateError) throw updateError;
                }
            } else {
                // New like/dislike
                const { error: insertError } = await window.supabase
                    .from('likes')
                    .insert([
                        {
                            post_id: postId,
                            user_id: authManager.currentUser.id,
                            like_type: likeType
                        }
                    ]);

                if (insertError) throw insertError;
            }

            // Reload posts to update the UI
            this.loadPosts();
        } catch (error) {
            console.error('Error handling like:', error);
            this.showMessage('Error updating like', 'error');
        }
    }

    async editPost(postId) {
        console.log('Starting edit for post:', postId);

        const postElement = document.querySelector(`[data-id="${postId}"]`);
        if (!postElement) {
            console.error('Post element not found for ID:', postId);
            return;
        }

        // Find the post content - look for the description or title
        let postContent = postElement.querySelector('.post-description') || postElement.querySelector('.post-title');
        if (!postContent) {
            console.error('Post content not found in element');
            return;
        }

        const originalContent = postContent.textContent;
        console.log('Original content:', originalContent);

        // Get the full post content from our stored posts data
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            console.error('Post data not found for ID:', postId);
            return;
        }

        const fullContent = post.content;
        console.log('Full post content:', fullContent);

        // Create edit form with the full content
        const editFormHTML = `
            <div class="edit-form">
                <textarea class="edit-textarea" maxlength="2000">${fullContent}</textarea>
                <div class="edit-actions">
                    <button class="save-edit-btn" onclick="postManager.saveEdit('${postId}')">Save</button>
                    <button class="cancel-edit-btn" onclick="postManager.cancelEdit('${postId}', \`${this.escapeHtml(fullContent)}\`)">Cancel</button>
                </div>
            </div>
        `;

        // Replace the post main content with edit form
        const postMain = postElement.querySelector('.post-main');
        if (postMain) {
            postMain.innerHTML = editFormHTML;
            console.log('Edit form created successfully');
        } else {
            console.error('Post main element not found');
        }
    }

    async saveEdit(postId) {
        const postElement = document.querySelector(`[data-id="${postId}"]`);
        const textarea = postElement.querySelector('.edit-textarea');
        const newContent = textarea.value.trim();

        if (!newContent) {
            this.showMessage('Post content cannot be empty', 'error');
            return;
        }

        try {
            const { error } = await window.supabase
                .from('posts')
                .update({ content: newContent })
                .eq('id', postId);

            if (error) throw error;

            this.loadPosts(); // Reload to show updated post
            this.showMessage('Post updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating post:', error);
            this.showMessage('Error updating post', 'error');
        }
    }

    cancelEdit(postId, originalContent) {
        console.log('Canceling edit for post:', postId);

        const postElement = document.querySelector(`[data-id="${postId}"]`);
        if (!postElement) {
            console.error('Post element not found for cancel');
            return;
        }

        // Get the full post data
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            console.error('Post data not found for cancel');
            return;
        }

        // Recreate the post element with original content
        const postMain = postElement.querySelector('.post-main');
        if (postMain) {
            // Create a title from the first line of content
            const contentLines = post.content.split('\n');
            const title = contentLines[0]?.substring(0, 50) + (contentLines[0]?.length > 50 ? '...' : '') || 'Untitled';
            const description = contentLines.slice(1).join('\n') || '';

            postMain.innerHTML = `
                <h3 class="post-title">${this.escapeHtml(title)}</h3>
                ${description ? `<p class="post-description">${this.escapeHtml(description)}</p>` : ''}
                <div class="post-interactions">
                    <div class="like-section">
                        <button class="like-btn" onclick="postManager.likePost('${postId}', 'like')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                                <path d="M7 10v12"/>
                                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>
                            </svg>
                            <span>${this.likesData[postId]?.likes || 0}</span>
                        </button>
                        <button class="dislike-btn" onclick="postManager.likePost('${postId}', 'dislike')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">
                                <path d="M17 14V2"/>
                                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>
                            </svg>
                            <span>${this.likesData[postId]?.dislikes || 0}</span>
                        </button>
                    </div>
                </div>
            `;

            console.log('Edit cancelled, post restored');
        }
    }

    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this hot take?')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('posts')
                .delete()
                .eq('id', postId);

            if (error) throw error;

            this.loadPosts(); // Reload to remove deleted post
            this.showMessage('Post deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showMessage('Error deleting post', 'error');
        }
    }

    togglePostMenu(postId) {
        // Close all other dropdowns first
        document.querySelectorAll('.post-dropdown').forEach(dropdown => {
            if (dropdown.id !== `dropdown-${postId}`) {
                dropdown.style.display = 'none';
            }
        });

        // Toggle the clicked dropdown
        const dropdown = document.getElementById(`dropdown-${postId}`);
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    }

    clearPosts() {
        this.posts = [];
        const postsContainer = document.getElementById('posts-container');
        if (postsContainer) {
            postsContainer.innerHTML = '';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateToggleUI() {
        const toggleElement = document.querySelector('.anonymous-toggle');
        if (toggleElement) {
            if (this.isAnonymous) {
                toggleElement.classList.add('active');
            } else {
                toggleElement.classList.remove('active');
            }
        }
    }

    showMessage(message, type) {
        // Create message element if it doesn't exist
        let messageEl = document.getElementById('post-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'post-message';
            document.getElementById('create-post').appendChild(messageEl);
        }

        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.style.display = 'block';

        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

// Global function for toggle
function toggleAnonymous() {
    postManager.isAnonymous = !postManager.isAnonymous;
    postManager.updateToggleUI();
}

// Navbar menu functions
function toggleNavMenu() {
    const dropdown = document.getElementById('nav-menu-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

function goToProfile() {
    window.location.href = 'profile.html';
    toggleNavMenu(); // Close dropdown after navigation
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('nav-menu-dropdown');
    const toggle = document.querySelector('.nav-menu-toggle');

    if (dropdown && toggle && !dropdown.contains(event.target) && !toggle.contains(event.target)) {
        dropdown.style.display = 'none';
    }
});

// Global function to view user profile
function viewUserProfile(userId) {
    // Navigate to profile page with user ID parameter
    window.location.href = `profile.html?userId=${userId}`;
}

// Quote rotation system
class QuoteRotator {
    constructor() {
        this.quotes = document.querySelectorAll('.quote-text');
        this.currentQuote = 0;
        this.intervalId = null;
        this.init();
    }

    init() {
        if (this.quotes.length === 0) return;

        // Start with first quote visible
        this.showQuote(0);

        // Start rotation every 3 seconds
        this.startRotation();
    }

    showQuote(index) {
        // Hide all quotes
        this.quotes.forEach(quote => {
            quote.classList.remove('active');
        });

        // Show selected quote
        if (this.quotes[index]) {
            this.quotes[index].classList.add('active');
        }
    }

    nextQuote() {
        // First, mark current quote as disappearing
        if (this.quotes[this.currentQuote]) {
            this.quotes[this.currentQuote].classList.add('disappearing');

            // Wait for disappear animation to complete, then show next quote
            setTimeout(() => {
                this.quotes[this.currentQuote].classList.remove('disappearing');
                this.currentQuote = (this.currentQuote + 1) % this.quotes.length;
                this.showQuote(this.currentQuote);
            }, 600); // Match CSS animation duration
        } else {
            // Fallback if no current quote
            this.currentQuote = (this.currentQuote + 1) % this.quotes.length;
            this.showQuote(this.currentQuote);
        }
    }

    startRotation() {
        this.intervalId = setInterval(() => {
            this.nextQuote();
        }, 3000); // 3 seconds
    }

    stopRotation() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// Initialize post manager
const postManager = new PostManager();

// Initialize quote rotator
const quoteRotator = new QuoteRotator();

// Marquee text scroll animation
class MarqueeAnimation {
    constructor() {
        this.marqueeText = document.getElementById('marqueeText');
        this.quoteSection = document.getElementById('quote-section');
        this.observer = null;
        this.lastScrollTop = 0;
        this.isScrollingDown = true;
        this.init();
    }

    init() {
        if (!this.marqueeText || !this.quoteSection) return;

        // Create intersection observer for scroll trigger
        this.setupScrollTrigger();

        // Setup bidirectional scroll detection
        this.setupScrollDirectionDetection();

        // Initial check in case element is already in view
        this.checkVisibility();
    }

    setupScrollTrigger() {
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.3 // Trigger when 30% of quote section is visible
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateIn();
                }
            });
        }, options);

        this.observer.observe(this.quoteSection);
    }

    setupScrollDirectionDetection() {
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.detectScrollDirection();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    detectScrollDirection() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > this.lastScrollTop) {
            // Scrolling down
            this.isScrollingDown = true;
            this.animateIn();
        } else {
            // Scrolling up
            this.isScrollingDown = false;
            this.animateOut();
        }

        this.lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For mobile or negative scrolling
    }

    animateIn() {
        if (this.marqueeText) {
            this.marqueeText.classList.add('animate');
        }
    }

    animateOut() {
        if (this.marqueeText) {
            this.marqueeText.classList.remove('animate');
        }
    }

    checkVisibility() {
        const rect = this.quoteSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        if (rect.top < windowHeight * 0.7 && rect.bottom > 0) {
            this.animateIn();
        }
    }
}

// Initialize marquee animation
const marqueeAnimation = new MarqueeAnimation();

// Scroll-Locked Subway Animation System
class ScrollLockedSubwayAnimation {
    constructor() {
        this.subwayContainer = document.getElementById('subway-container');
        this.subwayImage = document.getElementById('subway-image');
        this.heroSection = document.getElementById('hero-section');
        this.isScrollLocked = true;
        this.hasSubwayTriggered = false;
        this.unlockTimeout = null;
        this.init();
    }

    init() {
        if (!this.subwayContainer || !this.subwayImage || !this.heroSection) {
            console.warn('Subway elements not found');
            return;
        }

        // Lock scrolling initially
        this.lockScrolling();

        // Setup scroll detection (even when locked)
        this.setupScrollDetection();

        // Setup wheel/touch detection for immediate trigger
        this.setupImmediateTrigger();

        console.log('Scroll-locked subway system initialized');
    }

    lockScrolling() {
        // Lock scrolling on body and html
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // Ensure we're at the top
        window.scrollTo(0, 0);

        this.isScrollLocked = true;
        console.log('Scrolling locked');
    }

    unlockScrolling() {
        // Unlock scrolling
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        this.isScrollLocked = false;
        console.log('Scrolling unlocked');
    }

    setupScrollDetection() {
        // Detect scroll attempts even when locked
        let scrollDetectionTimeout;

        window.addEventListener('scroll', (e) => {
            if (this.isScrollLocked && !this.hasSubwayTriggered) {
                // Clear any existing timeout
                if (scrollDetectionTimeout) {
                    clearTimeout(scrollDetectionTimeout);
                }

                // Debounce scroll detection for immediate trigger
                scrollDetectionTimeout = setTimeout(() => {
                    this.triggerSubwayAnimation();
                }, 50); // Very short delay for immediate feel
            }
        }, { passive: false });
    }

    setupImmediateTrigger() {
        // Also detect wheel and touch events for immediate trigger
        const immediateEvents = ['wheel', 'touchmove'];

        immediateEvents.forEach(eventType => {
            window.addEventListener(eventType, (e) => {
                if (this.isScrollLocked && !this.hasSubwayTriggered) {
                    e.preventDefault();
                    this.triggerSubwayAnimation();
                }
            }, { passive: false });
        });
    }

    triggerSubwayAnimation() {
        if (this.hasSubwayTriggered) return;

        this.hasSubwayTriggered = true;
        console.log('Subway animation triggered');

        // Start subway reveal animation
        this.subwayContainer.classList.add('revealed');

        // Unlock scrolling after animation completes (1.5s matches CSS transition)
        this.unlockTimeout = setTimeout(() => {
            this.unlockScrolling();
        }, 1500);
    }

    // Setup automatic alternating effect for subway image
    setupAlternatingEffect() {
        if (!this.subwayImage) {
            console.warn('Subway image not found for alternating effect');
            return;
        }

        console.log('Setting up subway alternating effect...');

        // Wait for subway to be revealed before starting alternation
        const checkForReveal = () => {
            if (this.subwayContainer.classList.contains('revealed')) {
                console.log('Subway revealed, starting alternating effect');
                this.startAlternatingEffect();
            } else {
                setTimeout(checkForReveal, 100);
            }
        };

        checkForReveal();
    }

    startAlternatingEffect() {
        if (!this.subwayImage || this.alternatingInterval) return;

        this.originalSrc = this.subwayImage.src;
        // Use absolute URL to match the original image path
        this.alternateSrc = this.originalSrc.replace('subway.png', 'subway-hover.png');
        this.isShowingAlternate = false;
        this.alternatingInterval = null;

        console.log('Subway alternating effect started');
        console.log('Original image src:', this.originalSrc);
        console.log('Alternate image src:', this.alternateSrc);

        // Start alternating every 300ms
        this.alternatingInterval = setInterval(() => {
            this.switchToNextImage();
        }, 300);
    }

    switchToNextImage() {
        if (!this.subwayImage) return;

        if (this.isShowingAlternate) {
            this.subwayImage.src = this.originalSrc;
            this.isShowingAlternate = false;
        } else {
            this.subwayImage.src = this.alternateSrc;
            this.isShowingAlternate = true;
        }
    }

    stopAlternatingEffect() {
        if (this.alternatingInterval) {
            clearInterval(this.alternatingInterval);
            this.alternatingInterval = null;
            console.log('Subway alternating effect stopped');
        }
    }

    // Method to manually trigger (for testing)
    manualTrigger() {
        this.triggerSubwayAnimation();
    }

    // Cleanup method
    destroy() {
        this.unlockScrolling();
        if (this.unlockTimeout) {
            clearTimeout(this.unlockTimeout);
        }
    }
}

// Initialize scroll-locked subway animation
const scrollLockedSubway = new ScrollLockedSubwayAnimation();

// Setup subway alternating effect
scrollLockedSubway.setupAlternatingEffect();

// Bounce Effect quote animation for Hot or Not brand
class QuoteAnimation {
    constructor() {
        this.quoteElements = document.querySelectorAll('.quote-item');
        this.currentQuoteIndex = 0;
        this.animationTimeouts = [];
        this.rotationInterval = null;
        this.quotes = [
            "The UN is basically cosplay for world leaders now.",
            "Pineapple on pizza is actually fire",
            "I'd prefer Zuck over Elon any day!"
        ];
        this.init();
    }

    init() {
        if (this.quoteElements.length === 0) return;

        // Set initial state - hide all quotes
        this.quoteElements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(50px) scale(0.3)';
        });

        // Start with first quote
        this.showQuote(0);

        // Start bounce rotation every 3.5 seconds
        this.startBounceRotation();
    }

    showQuote(index) {
        // Clear any existing animations
        this.clearAnimationTimeouts();

        // Hide current quote with bounce out
        if (this.quoteElements[this.currentQuoteIndex]) {
            const currentElement = this.quoteElements[this.currentQuoteIndex];
            currentElement.style.animation = 'bounceOut 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';
        }

        // Show new quote with bounce in
        setTimeout(() => {
            if (this.quoteElements[index]) {
                const element = this.quoteElements[index];

                // Reset to starting position
                element.style.opacity = '0';
                element.style.transform = 'translateY(50px) scale(0.3)';
                element.style.animation = 'none';

                // Trigger reflow
                element.offsetHeight;

                // Start bounce in animation
                element.style.animation = 'bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';

                // Add brand glow effect after bounce
                setTimeout(() => {
                    element.style.filter = 'drop-shadow(0 0 10px rgba(236, 107, 21, 0.3))';

                    // Pulse effect for extra energy
                    setTimeout(() => {
                        element.style.filter = 'drop-shadow(0 0 15px rgba(236, 107, 21, 0.5))';
                        setTimeout(() => {
                            element.style.filter = 'drop-shadow(0 0 10px rgba(236, 107, 21, 0.3))';
                        }, 250);
                    }, 200);
                }, 600);
            }
        }, 200);

        this.currentQuoteIndex = index;
    }

    nextQuote() {
        const nextIndex = (this.currentQuoteIndex + 1) % this.quotes.length;
        this.showQuote(nextIndex);
    }

    startBounceRotation() {
        this.rotationInterval = setInterval(() => {
            this.nextQuote();
        }, 3500); // 3.5 seconds for energetic pacing
    }

    clearAnimationTimeouts() {
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationTimeouts = [];
    }

    stopRotation() {
        this.clearAnimationTimeouts();
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
        }
    }
}

// Initialize quote animation
const quoteAnimation = new QuoteAnimation();
