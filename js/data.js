// ============================================
// StockPro - Data Module v2 (Supabase CRUD)
// Corrections + Nouveaux modules
// ============================================

const Data = {

    // ============ HELPERS ============
    paginate(data, page, perPage = 50) {
        const total = data.length;
        const pages = Math.ceil(total / perPage);
        const start = (page - 1) * perPage;
        return {
            data: data.slice(start, start + perPage),
            page, perPage, total, pages
        };
    },

    renderPagination(total, page, perPage, onPage) {
        const pages = Math.ceil(total / perPage);
        if (pages <= 1) return '';
        let html = `<div class="flex items-center justify-between mt-4 px-2">
          <span class="text-sm text-gray-500">Total : <strong>${total}</strong></span>
          <div class="flex gap-1">`;
        for (let i = 1; i <= pages; i++) {
            html += `<button onclick="${onPage}(${i})"
              class="px-3 py-1 text-sm rounded-lg ${i === page ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">${i}</button>`;
        }
        html += `</div></div>`;
        return html;
    },

    filterByPeriod(data, dateField, from, to) {
        return data.filter(item => {
            const d = new Date(item[dateField]);
            if (from && d < new Date(from)) return false;
            if (to && d > new Date(to + 'T23:59:59')) return false;
            return true;
        });
    },

    formatCurrency(amount) {
        return Number(amount || 0).toLocaleString('fr-FR') + ' FC';
    },

    // ============ PRODUCTS ============
    async getProducts() {
        const { data } = await supabase.from('products').select('*, categories(name)').order('name', { ascending: true });
        return data || [];
    },

    async addProduct(product) {
        const { data } = await supabase.from('products').insert([{
            name: product.name,
            description: product.description || '',
            category: product.category || '',
            category_id: product.categoryId || null,
            price_per_carton: product.pricePerCarton,
            stock_level: product.stockLevel || 0,
            min_stock_level: product.minStockLevel || 10,
            created_by: product.createdBy
        }]).select().single();
        return data;
    },

    async updateProduct(id, updates) {
        const mapped = {};
        if (updates.name !== undefined) mapped.name = updates.name;
        if (updates.description !== undefined) mapped.description = updates.description;
        if (updates.category !== undefined) mapped.category = updates.category;
        if (updates.categoryId !== undefined) mapped.category_id = updates.categoryId;
        if (updates.pricePerCarton !== undefined) mapped.price_per_carton = updates.pricePerCarton;
        if (updates.stockLevel !== undefined) mapped.stock_level = updates.stockLevel;
        if (updates.minStockLevel !== undefined) mapped.min_stock_level = updates.minStockLevel;
        mapped.updated_at = new Date().toISOString();
        const { data } = await supabase.from('products').update(mapped).eq('id', id).select().single();
        return data;
    },

    async deleteProduct(id) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    // ============ STOCK ENTRIES ============
    async getStockEntries() {
        const { data } = await supabase.from('stock_entries').select('*, suppliers(name)').order('created_at', { ascending: false });
        return data || [];
    },

    async addStockEntry(entry) {
        const { data } = await supabase.from('stock_entries').insert([{
            product_id: entry.productId,
            product_name: entry.productName,
            quantity: entry.quantity,
            price_per_carton: entry.pricePerCarton,
            total_value: entry.totalValue,
            entry_date: entry.entryDate,
            supplier_id: entry.supplierId || null,
            supplier: entry.supplier || '',
            notes: entry.notes || '',
            created_by: entry.createdBy
        }]).select().single();

        // BUG FIX P2.5: Ne pas écraser price_per_carton du produit — juste incrémenter le stock
        const { data: product } = await supabase.from('products').select('stock_level').eq('id', entry.productId).single();
        if (product) {
            await supabase.from('products').update({
                stock_level: product.stock_level + entry.quantity,
                updated_at: new Date().toISOString()
                // ⚠️ price_per_carton N'est PAS mis à jour ici — il est géré dans le module Produits
            }).eq('id', entry.productId);
        }

        // Vérifier si le stock est remonté au-dessus du seuil min et supprimer la notification low_stock
        if (product) {
            const newLevel = product.stock_level + entry.quantity;
            const { data: prod } = await supabase.from('products').select('min_stock_level').eq('id', entry.productId).single();
            if (prod && newLevel > prod.min_stock_level) {
                await supabase.from('notifications').delete()
                    .eq('type', 'low_stock').eq('reference_id', entry.productId);
            }
        }

        return data;
    },

    // ============ CATEGORIES ============
    async getCategories() {
        const { data } = await supabase.from('categories').select('*').order('name', { ascending: true });
        return data || [];
    },

    async addCategory(cat) {
        const { data } = await supabase.from('categories').insert([{
            name: cat.name,
            description: cat.description || '',
            created_by: cat.createdBy
        }]).select().single();
        return data;
    },

    async updateCategory(id, updates) {
        const { data } = await supabase.from('categories').update({
            name: updates.name,
            description: updates.description || ''
        }).eq('id', id).select().single();
        return data;
    },

    async deleteCategory(id) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
    },

    // ============ SUPPLIERS (FOURNISSEURS) ============
    async getSuppliers() {
        const { data } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
        return data || [];
    },

    async addSupplier(sup) {
        const { data } = await supabase.from('suppliers').insert([{
            name: sup.name,
            contact_name: sup.contactName || '',
            phone: sup.phone || '',
            email: sup.email || '',
            address: sup.address || '',
            notes: sup.notes || '',
            is_active: sup.isActive !== undefined ? sup.isActive : true,
            created_by: sup.createdBy
        }]).select().single();
        return data;
    },

    async updateSupplier(id, updates) {
        const mapped = {};
        if (updates.name !== undefined) mapped.name = updates.name;
        if (updates.contactName !== undefined) mapped.contact_name = updates.contactName;
        if (updates.phone !== undefined) mapped.phone = updates.phone;
        if (updates.email !== undefined) mapped.email = updates.email;
        if (updates.address !== undefined) mapped.address = updates.address;
        if (updates.notes !== undefined) mapped.notes = updates.notes;
        if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
        const { data } = await supabase.from('suppliers').update(mapped).eq('id', id).select().single();
        return data;
    },

    async deleteSupplier(id) {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    },

    // ============ CLIENTS ============
    async getClients() {
        const { data } = await supabase.from('clients').select('*').order('name', { ascending: true });
        return data || [];
    },

    async addClient(client) {
        const { data } = await supabase.from('clients').insert([{
            name: client.name,
            location: client.location || '',
            phone: client.phone || '',
            email: client.email || '',
            address: client.address || '',
            created_by: client.createdBy
        }]).select().single();
        return data;
    },

    async updateClient(id, updates) {
        const { data } = await supabase.from('clients').update(updates).eq('id', id).select().single();
        return data;
    },

    async deleteClient(id) {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
    },

    // ============ INVOICES ============
    async getInvoices() {
        const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
        if (!data) return [];
        for (const inv of data) {
            const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
            inv.items = items || [];
        }
        return data;
    },

    async generateInvoiceNumber() {
        try {
            // BUG FIX P2.7: Utiliser la séquence SQL atomique via RPC
            const { data, error } = await supabase.rpc('next_invoice_number');
            if (!error && data) return data;
        } catch (e) { /* fallback */ }
        // Fallback si RPC non disponible
        const year = new Date().getFullYear();
        const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
            .like('invoice_number', `FAC-${year}%`);
        return `FAC-${year}-${((count || 0) + 1).toString().padStart(5, '0')}`;
    },

    async addInvoice(invoice) {
        const invoiceNumber = await this.generateInvoiceNumber();
        const { data: inv } = await supabase.from('invoices').insert([{
            invoice_number: invoiceNumber,
            client_id: invoice.clientId,
            client_name: invoice.clientName,
            subtotal: invoice.subtotal,
            tax: invoice.tax || 0,
            total: invoice.total,
            amount_paid: invoice.status === 'paid' ? invoice.total : 0,
            status: invoice.status,
            payment_method: invoice.paymentMethod || null,
            created_by: invoice.createdBy,
            paid_at: invoice.status === 'paid' ? new Date().toISOString() : null
        }]).select().single();

        if (!inv) return null;

        const items = invoice.items.map(item => ({
            invoice_id: inv.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            price_per_carton: item.pricePerCarton,
            total: item.total
        }));
        await supabase.from('invoice_items').insert(items);

        // Décrémenter le stock
        for (const item of invoice.items) {
            const { data: product } = await supabase.from('products').select('stock_level').eq('id', item.productId).single();
            if (product) {
                await supabase.from('products').update({
                    stock_level: Math.max(0, product.stock_level - item.quantity),
                    updated_at: new Date().toISOString()
                }).eq('id', item.productId);
            }
        }

        if (invoice.status === 'paid') {
            await this.addCashTransaction({
                type: 'invoice_payment',
                amount: invoice.total,
                description: `Paiement facture ${invoiceNumber} — ${invoice.clientName}`,
                reference: invoiceNumber,
                referenceId: inv.id,
                createdBy: invoice.createdBy
            });
        }

        // Générer des notifications de stock faible si nécessaire
        await this.checkAndNotifyLowStock();
        return inv;
    },

    async updateInvoice(id, updates) {
        const mapped = {};
        if (updates.status !== undefined) mapped.status = updates.status;
        if (updates.paymentMethod !== undefined) mapped.payment_method = updates.paymentMethod;

        if (updates.status === 'paid') {
            mapped.paid_at = new Date().toISOString();
            const { data: current } = await supabase.from('invoices').select('*').eq('id', id).single();
            if (current && current.status !== 'paid') {
                mapped.amount_paid = current.total;
                await this.addCashTransaction({
                    type: 'invoice_payment',
                    amount: current.total,
                    description: `Paiement facture ${current.invoice_number} — ${current.client_name}`,
                    reference: current.invoice_number,
                    referenceId: current.id,
                    createdBy: updates.createdBy || current.created_by
                });
            }
        }

        const { data } = await supabase.from('invoices').update(mapped).eq('id', id).select().single();
        return data;
    },

    async deleteInvoice(id) {
        // Récupérer la facture AVANT suppression
        const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).single();

        // Restaurer le stock
        const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id);
        if (items) {
            for (const item of items) {
                const { data: product } = await supabase.from('products').select('stock_level').eq('id', item.product_id).single();
                if (product) {
                    await supabase.from('products').update({
                        stock_level: product.stock_level + item.quantity,
                        updated_at: new Date().toISOString()
                    }).eq('id', item.product_id);
                }
            }
        }

        // BUG FIX P2.3: Supprimer la transaction caisse associée si la facture était payée
        if (inv && inv.status === 'paid') {
            await supabase.from('cash_transactions').delete()
                .eq('reference_id', id).eq('type', 'invoice_payment');
        }

        await supabase.from('invoices').delete().eq('id', id);
    },

    // ============ PAIEMENTS PARTIELS ============
    async getInvoicePayments(invoiceId) {
        const { data } = await supabase.from('invoice_payments').select('*')
            .eq('invoice_id', invoiceId).order('paid_at', { ascending: true });
        return data || [];
    },

    async addInvoicePayment(payment) {
        const { data: pymt } = await supabase.from('invoice_payments').insert([{
            invoice_id: payment.invoiceId,
            amount: payment.amount,
            payment_method: payment.paymentMethod || 'cash',
            notes: payment.notes || '',
            created_by: payment.createdBy
        }]).select().single();

        // Recalculer amount_paid et statut de la facture
        const { data: inv } = await supabase.from('invoices').select('total, amount_paid').eq('id', payment.invoiceId).single();
        if (inv) {
            const newPaid = Number(inv.amount_paid) + Number(payment.amount);
            const newStatus = newPaid >= Number(inv.total) ? 'paid' : 'partially_paid';
            await supabase.from('invoices').update({
                amount_paid: newPaid,
                status: newStatus,
                paid_at: newStatus === 'paid' ? new Date().toISOString() : null
            }).eq('id', payment.invoiceId);

            await this.addCashTransaction({
                type: 'invoice_payment',
                amount: payment.amount,
                description: payment.description || `Paiement partiel facture`,
                reference: payment.invoiceRef || '',
                referenceId: payment.invoiceId,
                createdBy: payment.createdBy
            });
        }
        return pymt;
    },

    // ============ AVOIRS / RETOURS ============
    async getReturns() {
        const { data } = await supabase.from('returns').select('*').order('created_at', { ascending: false });
        if (!data) return [];
        for (const ret of data) {
            const { data: items } = await supabase.from('return_items').select('*').eq('return_id', ret.id);
            ret.items = items || [];
        }
        return data;
    },

    async addReturn(ret) {
        const { data: numData, error } = await supabase.rpc('next_return_number');
        const returnNumber = (!error && numData) ? numData : `AV-${new Date().getFullYear()}-${Date.now()}`;

        const { data: newReturn } = await supabase.from('returns').insert([{
            return_number: returnNumber,
            invoice_id: ret.invoiceId || null,
            invoice_number: ret.invoiceNumber || '',
            client_id: ret.clientId,
            client_name: ret.clientName,
            reason: ret.reason || '',
            total: ret.total,
            status: 'pending',
            created_by: ret.createdBy
        }]).select().single();

        if (!newReturn) return null;

        if (ret.items && ret.items.length > 0) {
            const retItems = ret.items.map(item => ({
                return_id: newReturn.id,
                product_id: item.productId,
                product_name: item.productName,
                quantity: item.quantity,
                price_per_carton: item.pricePerCarton,
                total: item.total
            }));
            await supabase.from('return_items').insert(retItems);
        }
        return newReturn;
    },

    async approveReturn(id) {
        const { data: ret } = await supabase.from('returns').select('*').eq('id', id).single();
        if (!ret) return null;

        const { data: retItems } = await supabase.from('return_items').select('*').eq('return_id', id);

        // Restaurer le stock
        if (retItems) {
            for (const item of retItems) {
                const { data: product } = await supabase.from('products').select('stock_level').eq('id', item.product_id).single();
                if (product) {
                    await supabase.from('products').update({
                        stock_level: product.stock_level + item.quantity,
                        updated_at: new Date().toISOString()
                    }).eq('id', item.product_id);
                }
            }
        }

        // Transaction caisse négative (remboursement)
        if (ret.total > 0) {
            await this.addCashTransaction({
                type: 'return',
                amount: ret.total,
                description: `Avoir ${ret.return_number} — ${ret.client_name}`,
                reference: ret.return_number,
                referenceId: ret.id,
                createdBy: ret.created_by
            });
        }

        const { data } = await supabase.from('returns').update({
            status: 'approved'
        }).eq('id', id).select().single();
        return data;
    },

    async deleteReturn(id) {
        await supabase.from('returns').delete().eq('id', id);
    },

    // ============ COMMANDES FOURNISSEURS ============
    async getPurchaseOrders() {
        const { data } = await supabase.from('purchase_orders').select('*, suppliers(name)').order('created_at', { ascending: false });
        if (!data) return [];
        for (const ord of data) {
            const { data: items } = await supabase.from('purchase_order_items').select('*').eq('order_id', ord.id);
            ord.items = items || [];
        }
        return data;
    },

    async addPurchaseOrder(order) {
        const { data: numData } = await supabase.rpc('next_order_number');
        const orderNumber = numData || `BC-${new Date().getFullYear()}-${Date.now()}`;

        const { data: ord } = await supabase.from('purchase_orders').insert([{
            order_number: orderNumber,
            supplier_id: order.supplierId || null,
            supplier_name: order.supplierName,
            total: order.total,
            status: 'pending',
            expected_date: order.expectedDate || null,
            notes: order.notes || '',
            created_by: order.createdBy
        }]).select().single();

        if (!ord) return null;

        if (order.items && order.items.length > 0) {
            const items = order.items.map(item => ({
                order_id: ord.id,
                product_id: item.productId,
                product_name: item.productName,
                quantity: item.quantity,
                price_per_carton: item.pricePerCarton,
                total: item.total
            }));
            await supabase.from('purchase_order_items').insert(items);
        }
        return ord;
    },

    async updatePurchaseOrderStatus(id, status) {
        const { data } = await supabase.from('purchase_orders').update({ status }).eq('id', id).select().single();
        return data;
    },

    async receivePurchaseOrder(id, userId) {
        // Marquer comme reçu + générer des entrées de stock
        const { data: ord } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
        const { data: items } = await supabase.from('purchase_order_items').select('*').eq('order_id', id);

        if (items) {
            for (const item of items) {
                await this.addStockEntry({
                    productId: item.product_id,
                    productName: item.product_name,
                    quantity: item.quantity,
                    pricePerCarton: item.price_per_carton,
                    totalValue: item.total,
                    entryDate: new Date().toISOString().split('T')[0],
                    supplierId: ord?.supplier_id || null,
                    supplier: ord?.supplier_name || '',
                    notes: `Réception commande ${ord?.order_number}`,
                    createdBy: userId
                });
            }
        }

        const { data } = await supabase.from('purchase_orders').update({
            status: 'received',
            received_date: new Date().toISOString().split('T')[0]
        }).eq('id', id).select().single();
        return data;
    },

    async deletePurchaseOrder(id) {
        await supabase.from('purchase_orders').delete().eq('id', id);
    },

    // ============ PERSONNEL ============
    async getPersonnel() {
        const { data } = await supabase.from('personnel').select('*').order('created_at', { ascending: false });
        return data || [];
    },

    async generateMatricule() {
        try {
            // BUG FIX P2.7: Utiliser la séquence atomique
            const { data, error } = await supabase.rpc('next_employee_matricule');
            if (!error && data) return data;
        } catch (e) { /* fallback */ }
        const year = new Date().getFullYear();
        const { count } = await supabase.from('personnel').select('*', { count: 'exact', head: true });
        return `EMP-${year}-${((count || 0) + 1).toString().padStart(4, '0')}`;
    },

    async addPersonnel(person) {
        const matricule = await this.generateMatricule();
        const { data } = await supabase.from('personnel').insert([{
            matricule,
            first_name: person.firstName,
            last_name: person.lastName,
            phone: person.phone || '',
            id_card_number: person.idCardNumber || '',
            address: person.address || '',
            position: person.position || '',
            salary: person.salary || 0,
            hire_date: person.hireDate,
            is_active: person.isActive !== undefined ? person.isActive : true,
            created_by: person.createdBy
        }]).select().single();
        return data;
    },

    async updatePersonnel(id, updates) {
        const mapped = {};
        if (updates.firstName !== undefined) mapped.first_name = updates.firstName;
        if (updates.lastName !== undefined) mapped.last_name = updates.lastName;
        if (updates.phone !== undefined) mapped.phone = updates.phone;
        if (updates.idCardNumber !== undefined) mapped.id_card_number = updates.idCardNumber;
        if (updates.address !== undefined) mapped.address = updates.address;
        if (updates.position !== undefined) mapped.position = updates.position;
        if (updates.salary !== undefined) mapped.salary = updates.salary;
        if (updates.hireDate !== undefined) mapped.hire_date = updates.hireDate;
        if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
        const { data } = await supabase.from('personnel').update(mapped).eq('id', id).select().single();
        return data;
    },

    async deletePersonnel(id) {
        const { error } = await supabase.from('personnel').delete().eq('id', id);
        if (error) throw error;
    },

    // ============ CASH TRANSACTIONS ============
    async getCashTransactions() {
        const { data } = await supabase.from('cash_transactions').select('*').order('created_at', { ascending: false });
        return data || [];
    },

    async addCashTransaction(transaction) {
        const { data } = await supabase.from('cash_transactions').insert([{
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            reference: transaction.reference || '',
            reference_id: transaction.referenceId || null,
            created_by: transaction.createdBy
        }]).select().single();
        return data;
    },

    isIncome(type) {
        return ['invoice_payment', 'deposit'].includes(type);
    },

    async getCashBalance() {
        const transactions = await this.getCashTransactions();
        return transactions.reduce((balance, t) => {
            return this.isIncome(t.type) ? balance + Number(t.amount) : balance - Number(t.amount);
        }, 0);
    },

    // ============ ACTIVITIES ============
    async getActivities() {
        const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
        return data || [];
    },

    async addActivity(activity) {
        const { data } = await supabase.from('activities').insert([{
            title: activity.title,
            description: activity.description || '',
            cost: activity.cost || 0,
            date: activity.date,
            status: activity.status || 'pending',
            created_by: activity.createdBy
        }]).select().single();

        if (activity.cost && activity.cost > 0 && data) {
            await this.addCashTransaction({
                type: 'activity',
                amount: activity.cost,
                description: `Activité: ${activity.title}`,
                referenceId: data.id,
                createdBy: activity.createdBy
            });
        }
        return data;
    },

    async updateActivity(id, updates) {
        const mapped = {};
        if (updates.title !== undefined) mapped.title = updates.title;
        if (updates.description !== undefined) mapped.description = updates.description;
        if (updates.cost !== undefined) mapped.cost = updates.cost;
        if (updates.date !== undefined) mapped.date = updates.date;
        if (updates.status !== undefined) mapped.status = updates.status;

        // BUG FIX P2.9: Mettre à jour la transaction caisse si le coût change
        if (updates.cost !== undefined) {
            const { data: existing } = await supabase.from('activities').select('cost, title').eq('id', id).single();
            if (existing && Number(existing.cost) !== Number(updates.cost)) {
                // Supprimer l'ancienne transaction caisse
                await supabase.from('cash_transactions').delete().eq('reference_id', id).eq('type', 'activity');
                // Créer une nouvelle si le coût > 0
                if (Number(updates.cost) > 0) {
                    await this.addCashTransaction({
                        type: 'activity',
                        amount: updates.cost,
                        description: `Activité: ${updates.title || existing.title}`,
                        referenceId: id,
                        createdBy: updates.createdBy
                    });
                }
            }
        }

        const { data } = await supabase.from('activities').update(mapped).eq('id', id).select().single();
        return data;
    },

    async deleteActivity(id) {
        await supabase.from('cash_transactions').delete().eq('reference_id', id).eq('type', 'activity');
        await supabase.from('activities').delete().eq('id', id);
    },

    // ============ NOTIFICATIONS ============
    async getNotifications(onlyUnread = false) {
        let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
        if (onlyUnread) query = query.eq('is_read', false);
        const { data } = await query;
        return data || [];
    },

    async markNotificationRead(id) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },

    async markAllNotificationsRead() {
        await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    },

    async addNotification(notif) {
        // Éviter les doublons pour les notifications de stock faible
        if (notif.type === 'low_stock' && notif.referenceId) {
            const { data: existing } = await supabase.from('notifications').select('id')
                .eq('type', 'low_stock').eq('reference_id', notif.referenceId).eq('is_read', false).single();
            if (existing) return existing;
        }
        const { data } = await supabase.from('notifications').insert([{
            type: notif.type,
            title: notif.title,
            message: notif.message || '',
            reference_id: notif.referenceId || null,
            reference_type: notif.referenceType || '',
            target_role: notif.targetRole || 'admin'
        }]).select().single();
        return data;
    },

    async checkAndNotifyLowStock() {
        const products = await this.getProducts();
        for (const p of products) {
            if (p.stock_level <= p.min_stock_level) {
                await this.addNotification({
                    type: 'low_stock',
                    title: `Stock faible: ${p.name}`,
                    message: `Stock actuel: ${p.stock_level} cartons (min: ${p.min_stock_level})`,
                    referenceId: p.id,
                    referenceType: 'product'
                });
            }
        }
    },

    async checkAndNotifyOverdueInvoices() {
        const { data: invoices } = await supabase.from('invoices').select('*')
            .in('status', ['pending', 'partially_paid']);
        if (!invoices) return;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        for (const inv of invoices) {
            if (new Date(inv.created_at) < thirtyDaysAgo) {
                await this.addNotification({
                    type: 'overdue_invoice',
                    title: `Facture impayée: ${inv.invoice_number}`,
                    message: `${inv.client_name} — ${Number(inv.total).toLocaleString()} FC — ${Math.floor((new Date() - new Date(inv.created_at)) / 86400000)}j`,
                    referenceId: inv.id,
                    referenceType: 'invoice'
                });
            }
        }
    },

    // ============ SYSTEM LOGS ============
    async getLogs() {
        const { data } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(500);
        return data || [];
    },

    async addLog(log) {
        await supabase.from('system_logs').insert([{
            user_id: log.userId || 'unknown',
            user_name: log.userName || 'unknown',
            action: log.action,
            module: log.module,
            details: log.details || '',
            ip_address: log.ipAddress || ''
        }]);
    },

    // ============ USERS ============
    async getUsers() {
        const { data } = await supabase.from('users').select('id, username, full_name, role, email, phone, is_active, created_at, last_login').order('created_at', { ascending: false });
        return data || [];
    },

    async addUser(user) {
        const hash = await Auth.hashPassword(user.password);
        const { data, error } = await supabase.from('users').insert([{
            username: user.username,
            password: user.password,
            password_hash: hash,
            full_name: user.fullName,
            role: user.role || 'gestionnaire',
            email: user.email,
            phone: user.phone || '',
            is_active: user.isActive !== undefined ? user.isActive : true
        }]).select('id, username, full_name, role, email, phone, is_active, created_at').single();
        if (error) throw error;
        return data;
    },

    async updateUser(id, updates) {
        const mapped = {};
        if (updates.username !== undefined) mapped.username = updates.username;
        if (updates.password !== undefined) {
            mapped.password = updates.password;
            mapped.password_hash = await Auth.hashPassword(updates.password);
        }
        if (updates.fullName !== undefined) mapped.full_name = updates.fullName;
        if (updates.role !== undefined) mapped.role = updates.role;
        if (updates.email !== undefined) mapped.email = updates.email;
        if (updates.phone !== undefined) mapped.phone = updates.phone;
        if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
        const { data, error } = await supabase.from('users').update(mapped).eq('id', id)
            .select('id, username, full_name, role, email, phone, is_active').single();
        if (error) throw error;
        return data;
    },

    async deleteUser(id) {
        await supabase.from('users').delete().eq('id', id);
    }
};
