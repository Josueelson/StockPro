// ============================================
// StockPro - Authentication Module (v2)
// ============================================

const Auth = {
    currentUser: null,

    // SHA-256 hash avec salt fixe (sécurité côté client)
    async hashPassword(password) {
        if (!window.crypto || !window.crypto.subtle) {
            console.warn("Web Crypto API non disponible (contexte non sécurisé). Utilisation du mot de passe brut.");
            return password;
        }
        const encoder = new TextEncoder();
        const data = encoder.encode('stockpro_v2_' + password + '_securekey2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    init() {
        const saved = localStorage.getItem('currentUser');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved user:", e);
                localStorage.removeItem('currentUser');
            }
        }
        // Apply dark mode preference
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');
    },

    async login(username, password) {
        console.log("Attempting login for:", username);

        if (!supabase) {
            throw new Error("Supabase non initialisé. Vérifiez la console pour des erreurs de chargement.");
        }

        const hash = await this.hashPassword(password);

        try {
            // Tentative de login avec hash d'abord
            let { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password_hash', hash)
                .eq('is_active', true)
                .single();

            // Fallback: si pas de hash (comptes anciens), tenter avec password brut et migrer
            if (error || !data) {
                const fallback = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .eq('password', password)
                    .eq('is_active', true)
                    .single();

                if (fallback.error || !fallback.data) {
                    if (fallback.error && fallback.error.code !== 'PGRST116') throw fallback.error;
                    return false;
                }

                data = fallback.data;

                // Migration automatique : stocker le hash pour les futurs logins
                await supabase.from('users').update({ password_hash: hash }).eq('id', data.id);
                console.log("Mot de passe migré vers hash SHA-256 pour:", username);
            }

            this.currentUser = {
                id: data.id,
                username: data.username,
                fullName: data.full_name,
                role: data.role,
                email: data.email,
                phone: data.phone,
                isActive: data.is_active
            };

            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            // Mise à jour last_login
            await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', data.id);

            return true;
        } catch (err) {
            console.error("Exception during login process:", err);
            throw err;
        }
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    },

    isAuthenticated() {
        return !!this.currentUser;
    },

    isAdmin() {
        return this.currentUser?.role === 'admin';
    },

    getUser() {
        return this.currentUser;
    },

    requireAuth() {
        this.init();
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    requireAdmin() {
        if (!this.requireAuth()) return false;
        if (!this.isAdmin()) {
            window.location.href = 'dashboard.html';
            return false;
        }
        return true;
    },

    // Mise à jour du profil utilisateur
    async updateProfile(userId, updates) {
        if (!supabase) return { data: null, error: new Error("Supabase non initialisé") };
        const mapped = {};
        if (updates.email) mapped.email = updates.email;
        if (updates.phone) mapped.phone = updates.phone;
        if (updates.fullName) mapped.full_name = updates.fullName;
        if (updates.password) {
            mapped.password_hash = await this.hashPassword(updates.password);
            mapped.password = updates.password; // garde compat.
        }
        const { data, error } = await supabase.from('users').update(mapped).eq('id', userId).select().single();
        if (!error && data && this.currentUser && this.currentUser.id === userId) {
            if (updates.email) this.currentUser.email = updates.email;
            if (updates.phone) this.currentUser.phone = updates.phone;
            if (updates.fullName) this.currentUser.fullName = updates.fullName;
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
        return { data, error };
    },

    // Changement de mot de passe
    async changePassword(username, oldPassword, newPassword) {
        if (!supabase) return { success: false, message: "Supabase non initialisé" };
        
        // Vérifier l'ancien mot de passe
        const oldHash = await this.hashPassword(oldPassword);
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password_hash', oldHash)
            .single();
        
        // Fallback: vérifier avec l'ancien mot de passe en texte brut
        if (findError || !user) {
            const { data: fallbackUser, error: fallbackError } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', oldPassword)
                .single();
            
            if (fallbackError || !fallbackUser) {
                return { success: false, message: "Ancien mot de passe incorrect" };
            }
        }
        
        // Mettre à jour le mot de passe avec le nouveau hash
        const newHash = await this.hashPassword(newPassword);
        const { error: updateError } = await supabase
            .from('users')
            .update({ 
                password_hash: newHash,
                password: newPassword // garder pour compatibilité
            })
            .eq('username', username);
        
        if (updateError) {
            return { success: false, message: updateError.message };
        }
        
        return { success: true, message: "Mot de passe mis à jour avec succès" };
    }
};
