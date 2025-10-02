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
        const postContent = document.getElementById('post-content');
        const anonymousCheckbox = document.getElementById('anonymous-post');

        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const content = postContent.value.trim();
            const isAnonymous = anonymousCheckbox.checked;

            if (!content) {
                this.showMessage('Please enter your hot take!', 'error');
                return;
            }

            const result = await this.createPost(content, isAnonymous);

            if (result.success) {
                postContent.value = '';
                anonymousCheckbox.checked = false;
                this.showMessage('Hot take posted successfully!', 'success');
                this.loadPosts(); // Reload posts to show the new one
            } else {
                this.showMessage(result.message, 'error');
            }
        });
    }

    async createPost(content, isAnonymous) {
        try {
            const { data, error } = await window.supabase
                .from('posts')
                .insert([
                    {
                        content: content,
                        author_id: authManager.currentUser.id,
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
                    created_at,
                    author_id,
                    profiles:user_id(email)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.posts = data || [];
            this.displayPosts();
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showMessage('Error loading posts', 'error');
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
        const authorText = post.is_anonymous ? 'Anonymous' : 'User';
        const canEdit = !post.is_anonymous && post.author_id === authManager.currentUser?.id;

        return `
            <div class="post" data-id="${post.id}">
                <div class="post-header">
                    <span class="post-author">${authorText}</span>
                    <span class="post-date">${date}</span>
                </div>
                <div class="post-content">${this.escapeHtml(post.content)}</div>
                ${canEdit ? `
                    <div class="post-actions">
                        <button class="edit-btn" onclick="postManager.editPost('${post.id}')">Edit</button>
                        <button class="delete-btn" onclick="postManager.deletePost('${post.id}')">Delete</button>
                    </div>
                ` : ''}
            </div>
        `;
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
