// Profile Management
class ProfileManager {
    constructor() {
        this.userPosts = [];
        this.init();
    }

    async init() {
        // Wait for supabase to be available
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase client not loaded yet');
            setTimeout(() => this.init(), 100);
            return;
        }

        // Set up navigation
        this.setupNavigation();

        if (authManager.currentUser) {
            this.showProfileContent();
            await this.loadUserInfo();
            await this.loadUserPosts();
        } else {
            this.showAuthSection();
        }

        // Listen for auth changes
        window.supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                this.showProfileContent();
                this.loadUserInfo();
                this.loadUserPosts();
            } else {
                this.showAuthSection();
            }
        });

        // Set up profile picture upload event listener
        this.setupProfilePictureUpload();
    }

    setupNavigation() {
        // Navigation is now handled by the dropdown menu
        // No need for individual button event listeners
    }

    setupProfilePictureUpload() {
        // Profile picture upload event listener
        document.getElementById('profile-picture-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const imageUrl = await this.uploadProfilePicture(file);
                    this.displayProfilePicture(imageUrl);
                    this.showMessage('Profile picture updated successfully!', 'success');
                } catch (error) {
                    this.showMessage(error.message || 'Error uploading profile picture', 'error');
                }
            }
        });
    }

    showProfileContent() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('profile-content').style.display = 'block';
    }

    showAuthSection() {
        document.getElementById('profile-content').style.display = 'none';
        document.getElementById('auth-section').style.display = 'block';
    }

    async loadUserInfo() {
        try {
            const userDetails = document.getElementById('user-details');
            const email = authManager.currentUser.email;
            const emailPrefix = email.split('@')[0];

            // Load user profile or create default if doesn't exist
            const { data: profile, error } = await window.supabase
                .from('user_profiles')
                .select('display_name, profile_picture_url')
                .eq('user_id', authManager.currentUser.id)
                .single();

            let displayName = emailPrefix; // Default to email prefix
            let profilePictureUrl = null;

            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
                    // Profile doesn't exist, create it with email prefix as default
                    console.log('Creating default profile for user:', authManager.currentUser.id);
                    const createResult = await this.createDefaultProfile(emailPrefix);
                    if (createResult.success) {
                        console.log('Default profile created successfully');
                    } else {
                        console.error('Failed to create default profile:', createResult.error);
                    }
                } else {
                    console.error('Error loading profile:', error);
                }
            } else {
                if (profile?.display_name) {
                    displayName = profile.display_name;
                }
                profilePictureUrl = profile?.profile_picture_url || null;
            }

            // Calculate hotness (sum of all likes on user's posts)
            const hotness = await this.calculateHotness();

            // Handle profile picture and text separately to avoid interference
            this.handleProfilePictureSeparately(profilePictureUrl, emailPrefix);
            this.handleTextContentSeparately(displayName, hotness);

        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    async createDefaultProfile(emailPrefix) {
        try {
            const { error } = await window.supabase
                .from('user_profiles')
                .insert([
                    {
                        user_id: authManager.currentUser.id,
                        display_name: emailPrefix,
                        profile_picture_url: null
                    }
                ]);

            if (error) {
                console.error('Error creating default profile:', error);
                return { success: false, error };
            }

            return { success: true };
        } catch (error) {
            console.error('Error creating default profile:', error);
            return { success: false, error };
        }
    }

    displayProfilePicture(imageUrl) {
        const img = document.getElementById('profile-picture-img');
        const placeholder = document.getElementById('profile-picture-placeholder');

        img.src = imageUrl;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    }

    showDefaultAvatar(emailPrefix) {
        const img = document.getElementById('profile-picture-img');
        const placeholder = document.getElementById('profile-picture-placeholder');

        img.style.display = 'none';
        placeholder.style.display = 'block';

        // Show user initial
        const initial = emailPrefix.charAt(0).toUpperCase();
        placeholder.innerHTML = `<span style="font-size: 2.5rem; font-weight: bold; color: white;">${initial}</span>`;
    }

    async uploadProfilePicture(file) {
        try {
            // Define storage config if not available
            if (!window.STORAGE_CONFIG) {
                window.STORAGE_CONFIG = {
                    bucket: 'DPs',
                    maxFileSize: 5 * 1024 * 1024, // 5MB
                    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
                };
            }

            // Validate file using config
            if (file.size > window.STORAGE_CONFIG.maxFileSize) {
                throw new Error(`File size must be less than ${Math.round(window.STORAGE_CONFIG.maxFileSize / (1024 * 1024))}MB`);
            }

            if (!window.STORAGE_CONFIG.allowedTypes.includes(file.type)) {
                throw new Error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
            }

            // Show loading state
            const uploadBtn = document.getElementById('upload-picture-btn');
            const originalText = uploadBtn.textContent;
            uploadBtn.textContent = 'Uploading...';
            uploadBtn.disabled = true;

            // Create unique filename with user ID folder structure
            const fileExt = file.name.split('.').pop();
            const timestamp = Date.now();
            const fileName = `${authManager.currentUser.id}/${authManager.currentUser.id}_${timestamp}.${fileExt}`;

            console.log('Uploading file:', fileName, 'to bucket:', window.STORAGE_CONFIG.bucket);

            // Upload to Supabase Storage
            const { data, error } = await window.supabase.storage
                .from(window.STORAGE_CONFIG.bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true // Allow overwriting existing files
                });

            if (error) {
                console.error('Storage upload error:', error);
                throw new Error(`Upload failed: ${error.message}`);
            }

            console.log('Upload successful:', data);

            // Get public URL
            const { data: urlData } = window.supabase.storage
                .from(window.STORAGE_CONFIG.bucket)
                .getPublicUrl(fileName);

            console.log('Generated URL:', urlData.publicUrl);

            // Update both tables
            await this.updateProfilePictureUrl(urlData.publicUrl);

            // Reset upload button
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading profile picture:', error);

            // Reset upload button
            const uploadBtn = document.getElementById('upload-picture-btn');
            if (uploadBtn) {
                uploadBtn.textContent = 'Upload Picture';
                uploadBtn.disabled = false;
            }

            throw error;
        }
    }

    async updateProfilePictureUrl(imageUrl) {
        try {
            // Update user_profiles table
            const { error: profileError } = await window.supabase
                .from('user_profiles')
                .upsert({
                    user_id: authManager.currentUser.id,
                    profile_picture_url: imageUrl
                });

            if (profileError) throw profileError;

            // Update all existing posts by this user (due to trigger)
            const { error: postsError } = await window.supabase
                .from('posts')
                .update({ author_profile_picture_url: imageUrl })
                .eq('author_id', authManager.currentUser.id);

            if (postsError) {
                console.error('Error updating posts with profile picture:', postsError);
                // Don't throw error since profile update succeeded
            }
        } catch (error) {
            console.error('Error updating profile picture URL:', error);
            throw error;
        }
    }

    handleProfilePictureSeparately(profilePictureUrl, emailPrefix) {
        // Handle ONLY the profile picture, don't touch text elements
        if (profilePictureUrl) {
            this.displayProfilePicture(profilePictureUrl);
        } else {
            this.showDefaultAvatar(emailPrefix);
        }
    }

    handleTextContentSeparately(displayName, hotness) {
        // Handle ONLY the text content, don't touch profile picture
        const userDetails = document.getElementById('user-details');
        if (!userDetails) return;

        // Check if text elements exist
        let nameText = document.getElementById('display-name-text');
        let hotnessCount = document.getElementById('hotness-count');

        if (!nameText || !hotnessCount) {
            // Create text structure if it doesn't exist
            const textContainer = document.createElement('div');
            textContainer.style.textAlign = 'center';
            textContainer.innerHTML = `
                <p style="margin: 0; font-size: 1.2rem; font-weight: 600; color: #333; margin-bottom: 0.5rem;">
                    <span id="display-name-text">${displayName}</span>
                    <button id="edit-name-btn" onclick="profileManager.editDisplayName()" style="margin-left: 8px; padding: 4px 8px; font-size: 0.8rem;">Edit</button>
                </p>
                <p style="margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; color: #ff6b35;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame-icon lucide-flame">
                        <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>
                    </svg>
                    <span style="font-weight: 500; font-size: 1rem; margin-right: 4px;">Hotness Score</span>
                    <span id="hotness-count" style="font-weight: 600; font-size: 1.1rem;">${hotness}</span>
                </p>
                <div id="name-edit-form" style="display: none; margin-top: 1rem;">
                    <input type="text" id="display-name-input" placeholder="Enter display name" value="${displayName}" style="padding: 8px; margin-right: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <button onclick="profileManager.saveDisplayName()">Save</button>
                    <button onclick="profileManager.cancelEditName()">Cancel</button>
                </div>
            `;

            // Insert after the profile picture container
            const profilePictureContainer = userDetails.querySelector('.profile-picture-container');
            if (profilePictureContainer) {
                userDetails.insertBefore(textContainer, profilePictureContainer.nextSibling);
            } else {
                userDetails.appendChild(textContainer);
            }
        } else {
            // Just update existing text content
            nameText.textContent = displayName;
            hotnessCount.textContent = hotness;
        }
    }

    async loadUserPosts() {
        try {
            const { data, error } = await window.supabase
                .from('posts')
                .select('*')
                .eq('author_id', authManager.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.userPosts = data || [];
            this.displayUserPosts();
            this.updatePostCount();
        } catch (error) {
            console.error('Error loading user posts:', error);
            this.showMessage('Error loading your posts', 'error');
        }
    }

    displayUserPosts() {
        const container = document.getElementById('user-posts-container');

        if (this.userPosts.length === 0) {
            container.innerHTML = '<p>You haven\'t posted any hot takes yet. <a href="index.html">Go share your first one!</a></p>';
            return;
        }

        container.innerHTML = this.userPosts.map(post => this.createUserPostElement(post)).join('');
    }

    createUserPostElement(post) {
        const date = new Date(post.created_at).toLocaleDateString();
        const time = new Date(post.created_at).toLocaleTimeString();
        const anonymousBadge = post.is_anonymous ? '<span class="anonymous-badge">Anonymous</span>' : '';

        // Parse content to separate title and description (same as main feed)
        const contentLines = post.content.split('\n');
        const title = contentLines[0]?.substring(0, 50) + (contentLines[0]?.length > 50 ? '...' : '') || 'Untitled';
        const description = contentLines.slice(1).join('\n') || '';

        return `
            <div class="post" data-id="${post.id}">
                <div class="post-header">
                    <span class="post-date">${date} at ${time}</span>
                    ${anonymousBadge}
                </div>
                <div class="post-main">
                    <h3 class="post-title">${this.escapeHtml(title)}</h3>
                    ${description ? `<p class="post-description">${this.escapeHtml(description)}</p>` : ''}
                </div>
                <div class="post-actions">
                    <button class="edit-btn" onclick="profileManager.editPost('${post.id}')" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil">
                            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                            <path d="m15 5 4 4"/>
                        </svg>
                    </button>
                    <button class="delete-btn" onclick="profileManager.deletePost('${post.id}')" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-icon lucide-trash">
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                            <path d="M3 6h18"/>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
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
                <button onclick="profileManager.saveEdit('${postId}')">Save</button>
                <button onclick="profileManager.cancelEdit('${postId}', '${this.escapeHtml(originalContent)}')">Cancel</button>
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

            await this.loadUserPosts(); // Reload to show updated post
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
        if (!confirm('Are you sure you want to delete this hot take? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('posts')
                .delete()
                .eq('id', postId);

            if (error) throw error;

            await this.loadUserPosts(); // Reload to remove deleted post
            this.showMessage('Post deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showMessage('Error deleting post', 'error');
        }
    }

    editDisplayName() {
        document.getElementById('display-name-text').style.display = 'none';
        document.getElementById('edit-name-btn').style.display = 'none';
        document.getElementById('name-edit-form').style.display = 'block';

        const input = document.getElementById('display-name-input');
        setTimeout(() => input.focus(), 100);
    }

    cancelEditName() {
        document.getElementById('display-name-text').style.display = 'inline';
        document.getElementById('edit-name-btn').style.display = 'inline';
        document.getElementById('name-edit-form').style.display = 'none';

        // Reset input value
        const emailPrefix = authManager.currentUser.email.split('@')[0];
        document.getElementById('display-name-input').value = document.getElementById('display-name-text').textContent || emailPrefix;
    }

    async saveDisplayName() {
        const input = document.getElementById('display-name-input');
        const newDisplayName = input.value.trim();

        if (!newDisplayName) {
            this.showMessage('Display name cannot be empty', 'error');
            return;
        }

        try {
            // Check if profile exists
            const { data: existingProfile, error: fetchError } = await window.supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', authManager.currentUser.id)
                .single();

            let result;
            if (existingProfile) {
                // Update existing profile
                result = await window.supabase
                    .from('user_profiles')
                    .update({ display_name: newDisplayName })
                    .eq('user_id', authManager.currentUser.id);
            } else {
                // Create new profile
                result = await window.supabase
                    .from('user_profiles')
                    .insert([
                        {
                            user_id: authManager.currentUser.id,
                            display_name: newDisplayName
                        }
                    ]);
            }

            if (result.error) throw result.error;

            // Update existing posts to use new display name
            await this.updateExistingPostsDisplayName(newDisplayName);

            // Update the display
            document.getElementById('display-name-text').textContent = newDisplayName;
            this.cancelEditName();
            this.showMessage('Display name updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating display name:', error);
            this.showMessage('Error updating display name', 'error');
        }
    }

    async updateExistingPostsDisplayName(newDisplayName) {
        try {
            // Update all existing posts by this user to use the new display name
            const { error } = await window.supabase
                .from('posts')
                .update({ author_display_name: newDisplayName })
                .eq('author_id', authManager.currentUser.id)
                .eq('is_anonymous', false); // Only update non-anonymous posts

            if (error) {
                console.error('Error updating existing posts:', error);
                // Don't show error to user since the profile update succeeded
            }
        } catch (error) {
            console.error('Error updating existing posts display name:', error);
        }
    }

    async calculateHotness() {
        try {
            // Get all likes for posts by this user
            const { data: likesData, error } = await window.supabase
                .from('likes')
                .select('like_type')
                .in('post_id', this.userPosts.map(post => post.id));

            if (error) throw error;

            // Sum up all likes (dislikes don't count toward hotness)
            const hotness = likesData?.filter(like => like.like_type === 'like').length || 0;

            return hotness;
        } catch (error) {
            console.error('Error calculating hotness:', error);
            return 0;
        }
    }

    updatePostCount() {
        const postCountElement = document.getElementById('post-count');
        if (postCountElement) {
            postCountElement.textContent = this.userPosts.length;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(message, type) {
        // Create message element if it doesn't exist
        let messageEl = document.getElementById('profile-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'profile-message';
            document.getElementById('user-posts').insertBefore(messageEl, document.getElementById('user-posts-container'));
        }

        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.style.display = 'block';

        setTimeout(() => {
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        }, 3000);
    }
}

// Navbar menu functions
function toggleNavMenu() {
    const dropdown = document.getElementById('nav-menu-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

function goToHome() {
    window.location.href = 'index.html';
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

// Initialize profile manager
const profileManager = new ProfileManager();
