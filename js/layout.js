// ============================================
// StockPro - Layout Module v2 (Sidebar + Header + Dark Mode + Notifications)
// ============================================

const Layout = {
  sidebarOpen: true,
  userMenuOpen: false,

  menuItems: [
    { path: 'dashboard.html', icon: 'layout-dashboard', label: 'Tableau de bord', roles: ['admin', 'gestionnaire'] },
    { path: 'products.html', icon: 'package', label: 'Produits', roles: ['admin', 'gestionnaire'] },
    { path: 'categories.html', icon: 'tag', label: 'Catégories', roles: ['admin', 'gestionnaire'] },
    { path: 'stock.html', icon: 'shopping-cart', label: 'Stock (Entrées)', roles: ['admin', 'gestionnaire'] },
    { path: 'invoices.html', icon: 'file-text', label: 'Factures (Sorties)', roles: ['admin', 'gestionnaire'] },
    { path: 'returns.html', icon: 'rotate-ccw', label: 'Avoirs / Retours', roles: ['admin', 'gestionnaire'] },
    { path: 'clients.html', icon: 'users', label: 'Clients', roles: ['admin', 'gestionnaire'] },
    { path: 'suppliers.html', icon: 'truck', label: 'Fournisseurs', roles: ['admin', 'gestionnaire'] },
    { path: 'orders.html', icon: 'clipboard-list', label: 'Commandes', roles: ['admin', 'gestionnaire'] },
    { path: 'cash.html', icon: 'dollar-sign', label: 'Caisse', roles: ['admin', 'gestionnaire'] },
    { path: 'personnel.html', icon: 'user-cog', label: 'Personnel', roles: ['admin', 'gestionnaire'] },
    { path: 'activities.html', icon: 'activity', label: 'Activités', roles: ['admin', 'gestionnaire'] },
    { path: 'reports.html', icon: 'bar-chart-2', label: 'Rapports', roles: ['admin', 'gestionnaire'] },
    { path: 'notifications.html', icon: 'bell', label: 'Notifications', roles: ['admin', 'gestionnaire'] },
    { path: 'users.html', icon: 'user', label: 'Utilisateurs', roles: ['admin'] },
    { path: 'logs.html', icon: 'settings', label: 'Journal Système', roles: ['admin'] },
  ],

  async init() {
    const user = Auth.getUser();
    if (!user) return;

    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const filteredItems = this.menuItems.filter(item => item.roles.includes(user.role));
    const currentItem = filteredItems.find(item => item.path === currentPage);
    const pageTitle = currentItem ? currentItem.label : 'Dashboard';

    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Charger les notifications non lues
    let unreadCount = 0;
    let recentNotifs = [];
    try {
      const notifs = await Data.getNotifications(true);
      unreadCount = notifs.length;
      recentNotifs = notifs.slice(0, 5);
    } catch (e) { /* silently fail */ }

    // Vérifier les notifications (factures impayées + stock faible)
    try {
      await Data.checkAndNotifyLowStock();
      await Data.checkAndNotifyOverdueInvoices();
    } catch (e) { /* silently fail */ }

    const sidebarMenuHtml = filteredItems.map(item => {
      const isActive = item.path === currentPage;
      return `
        <li>
          <a href="${item.path}" class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-amber-500 text-white' : 'text-gray-300 hover:bg-white/10'}">
            <i data-lucide="${item.icon}" class="w-5 h-5 flex-shrink-0"></i>
            <span class="sidebar-label">${item.label}</span>
          </a>
        </li>
      `;
    }).join('');

    const notifHtml = recentNotifs.map(n => `
          <div class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 cursor-pointer" onclick="Layout.readNotif('${n.id}', '${n.reference_type}', '${n.reference_id || ''}')">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-100">${n.title}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${n.message}</p>
          </div>
        `).join('') || `<p class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Aucune notification</p>`;

    const layoutHtml = `
      <!-- Sidebar -->
      <aside id="sidebar" class="sidebar fixed left-0 top-0 h-full z-40 transition-all duration-300 w-64">
        <div class="flex flex-col h-full">
          <!-- Logo -->
          <div class="p-4 border-b border-white/10">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <i data-lucide="package" class="w-6 h-6 text-white"></i>
              </div>
              <div class="sidebar-label">
                <h1 class="text-white font-bold text-lg">StockPro</h1>
                <p class="text-gray-400 text-xs">Gestion d'Entrepôt</p>
              </div>
            </div>
          </div>

          <!-- Navigation -->
          <nav class="flex-1 p-4 overflow-y-auto">
            <ul class="space-y-1">
              ${sidebarMenuHtml}
            </ul>
          </nav>

          <!-- User Info -->
          <div class="p-4 border-t border-white/10">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                <i data-lucide="user" class="w-5 h-5 text-white"></i>
              </div>
              <div class="sidebar-label flex-1 min-w-0">
                <p class="text-white text-sm font-medium truncate">${user.fullName}</p>
                <p class="text-gray-400 text-xs capitalize">${user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div id="main-wrapper" class="flex-1 transition-all duration-300 ml-64">
        <!-- Header -->
        <header class="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-30">
          <div class="flex items-center justify-between px-6 py-4">
            <div class="flex items-center gap-4">
              <button id="toggle-sidebar" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <i data-lucide="menu" class="w-5 h-5 dark:text-gray-200" id="sidebar-icon"></i>
              </button>
              <div>
                <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">${pageTitle}</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">${dateStr}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <!-- Notifications Bell -->
              <div class="relative">
                <button id="notif-btn" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative">
                  <i data-lucide="bell" class="w-5 h-5 text-gray-600 dark:text-gray-300"></i>
                  ${unreadCount > 0 ? `<span class="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
                </button>
                <div id="notif-panel" class="hidden absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50">
                  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p class="font-semibold text-gray-800 dark:text-gray-100">Notifications</p>
                    <button onclick="Layout.readAll()" class="text-xs text-blue-600 hover:underline">Tout marquer lu</button>
                  </div>
                  ${notifHtml}
                  <a href="notifications.html" class="block px-4 py-3 text-center text-sm text-[#1e3a5f] dark:text-blue-400 hover:underline border-t border-gray-100 dark:border-gray-700">
                    Voir toutes les notifications
                  </a>
                </div>
              </div>

              <!-- Dark Mode Toggle -->
              <button id="dark-toggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Mode sombre">
                <i data-lucide="moon" class="w-5 h-5 text-gray-600 dark:text-gray-300" id="dark-icon"></i>
              </button>

              <!-- User Menu -->
              <div class="relative">
                <button id="user-menu-btn" class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div class="w-8 h-8 bg-[#1e3a5f] rounded-full flex items-center justify-center">
                    <i data-lucide="user" class="w-4 h-4 text-white"></i>
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">${user.fullName}</span>
                  <i data-lucide="chevron-down" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
                </button>
                <div id="user-menu" class="hidden absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50">
                  <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p class="font-medium text-sm dark:text-gray-100">${user.fullName}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.email}</p>
                  </div>
                  <a href="profile.html" class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                    <i data-lucide="user-circle" class="w-4 h-4"></i>
                    Mon Profil
                  </a>
                  <button onclick="Auth.logout()" class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="p-6" id="page-content">
        </main>
      </div>
    `;

    document.getElementById('app').innerHTML = layoutHtml;
    if (window.lucide) lucide.createIcons();

    // Toggle sidebar
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
      this.sidebarOpen = !this.sidebarOpen;
      const sidebar = document.getElementById('sidebar');
      const mainWrapper = document.getElementById('main-wrapper');
      if (this.sidebarOpen) {
        sidebar.classList.remove('w-20');
        sidebar.classList.add('w-64');
        mainWrapper.classList.remove('ml-20');
        mainWrapper.classList.add('ml-64');
        document.querySelectorAll('.sidebar-label').forEach(el => el.classList.remove('hidden'));
      } else {
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-20');
        mainWrapper.classList.remove('ml-64');
        mainWrapper.classList.add('ml-20');
        document.querySelectorAll('.sidebar-label').forEach(el => el.classList.add('hidden'));
      }
    });

    // Toggle notifications
    document.getElementById('notif-btn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('notif-panel').classList.toggle('hidden');
      document.getElementById('user-menu').classList.add('hidden');
    });

    // Toggle user menu
    document.getElementById('user-menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('user-menu').classList.toggle('hidden');
      document.getElementById('notif-panel').classList.add('hidden');
    });

    document.addEventListener('click', () => {
      document.getElementById('user-menu')?.classList.add('hidden');
      document.getElementById('notif-panel')?.classList.add('hidden');
    });

    // Dark Mode
    const darkToggle = document.getElementById('dark-toggle');
    const darkIcon = document.getElementById('dark-icon');
    const updateDarkIcon = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      darkIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      lucide.createIcons();
    };
    updateDarkIcon();
    darkToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('darkMode', !isDark);
      updateDarkIcon();
    });
  },

  async readNotif(id, refType, refId) {
    await Data.markNotificationRead(id);
    if (refType === 'product') window.location.href = 'products.html';
    else if (refType === 'invoice') window.location.href = 'invoices.html';
    else window.location.href = 'notifications.html';
  },

  async readAll() {
    await Data.markAllNotificationsRead();
    window.location.reload();
  }
};
