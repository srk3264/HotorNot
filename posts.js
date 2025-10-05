// Post Management
class PostManager {
    constructor() {
        this.posts = [];
        this.init();
    }

    async init() {
        // Wait for supabase to be available
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase client not loaded yet');
            setTimeout(() => this.init(), 100);
            return;
        }

        if (authManager.currentUser) {
            this.loadPosts();
        }

        // Listen for auth changes to reload posts
        window.supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                this.loadPosts();
            } else {
                this.clearPosts();
            }
        });

        // Set up post form
        this.setupPostForm();
    }

    setupPostForm() {
        const postForm = document.getElementById('post-form');
        const postTitle = document.getElementById('post-title');
        const postContent = document.getElementById('post-content');

        // Character counters
        const titleCounter = document.querySelector('#post-title + .char-counter');
        const contentCounter = document.querySelector('#post-content + .char-counter');

        // Update character counters
        postTitle.addEventListener('input', () => {
            titleCounter.textContent = `${postTitle.value.length}/200`;
        });

        postContent.addEventListener('input', () => {
            contentCounter.textContent = `${postContent.value.length}/1000`;
        });

        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = postTitle.value.trim();
            const content = postContent.value.trim();

            if (!title || !content) {
                this.showMessage('Please enter both title and content!', 'error');
                return;
            }

            const fullContent = `${title}\n\n${content}`;
            const result = await this.createPost(fullContent, false); // Always non-anonymous

            if (result.success) {
                postTitle.value = '';
                postContent.value = '';
                titleCounter.textContent = '0/200';
                contentCounter.textContent = '0/1000';
                this.showMessage('Hot take posted successfully!', 'success');
                this.loadPosts(); // Reload posts to show the new one
            } else {
                this.showMessage(result.message, 'error');
            }
        });
    }

    async createPost(content, isAnonymous) {
        try {
            // Get current display name from user_profiles
            let authorDisplayName = null;
            if (!isAnonymous) {
                const { data: profile, error: profileError } = await window.supabase
                    .from('user_profiles')
                    .select('display_name')
                    .eq('user_id', authManager.currentUser.id)
                    .single();

                if (profile?.display_name) {
                    authorDisplayName = profile.display_name;
                } else {
                    // Fallback to email prefix if profile doesn't exist
                    authorDisplayName = authManager.currentUser.email.split('@')[0];
                }
            }

            const { data, error } = await window.supabase
                .from('posts')
                .insert([
                    {
                        content: content,
                        author_id: authManager.currentUser.id,
                        author_display_name: authorDisplayName,
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
                    author_id
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

    displayPosts() {
        const container = document.getElementById('posts-container');

        if (this.posts.length === 0) {
            container.innerHTML = '<p>No hot takes yet. Be the first to share your unpopular opinion!</p>';
            return;
        }

        container.innerHTML = this.posts.map(post => this.createPostElement(post)).join('');
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
                        <div class="avatar-circle">${post.is_anonymous ? '👤' : '👤'}</div>
                    </div>
                    <div class="post-user-info">
                        <span class="post-username">${authorText}</span>
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
        const postElement = document.querySelector(`[data-id="${postId}"]`);
        const postContent = postElement.querySelector('.post-content');
        const originalContent = postContent.textContent;

        // Create edit form
        postContent.innerHTML = `
            <textarea class="edit-textarea">${originalContent}</textarea>
            <div class="edit-actions">
                <button onclick="postManager.saveEdit('${postId}')">Save</button>
                <button onclick="postManager.cancelEdit('${postId}', '${this.escapeHtml(originalContent)}')">Cancel</button>
            </div>
        `;
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
        const postElement = document.querySelector(`[data-id="${postId}"]`);
        const postContent = postElement.querySelector('.post-content');
        postContent.textContent = originalContent;
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
        document.getElementById('posts-container').innerHTML = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

// Initialize post manager
const postManager = new PostManager();
