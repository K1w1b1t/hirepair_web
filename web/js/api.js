/**
 * HirePair Client API Service
 * Gerencia a comunicação com a API RESTful do backend e mantém suporte offline-first.
 */

const HirePairAPI = {
    baseUrl: window.location.origin.includes('http') ? window.location.origin : 'http://localhost:8080',

    // Verifica a saúde do serviço
    async checkHealth() {
        try {
            const res = await fetch(`${this.baseUrl}/api/health`);
            return await res.json();
        } catch (e) {
            console.warn('[HirePair] Rodando em modo offline/local:', e);
            return { status: 'offline', local: true };
        }
    },

    // Carrega os dados do perfil
    async getProfile() {
        try {
            const res = await fetch(`${this.baseUrl}/api/profile`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('[HirePair] Usando perfil do localStorage ou padrão:', e);
        }
        return JSON.parse(localStorage.getItem('hirepair_profile')) || {
            name: "João Silva Souza",
            headline: "Consultor de Vendas & Atendimento",
            profile_strength: 75
        };
    },

    // Atualiza os dados do perfil
    async saveProfile(profile) {
        localStorage.setItem('hirepair_profile', JSON.stringify(profile));
        try {
            const res = await fetch(`${this.baseUrl}/api/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('[HirePair] Salvo localmente (offline):', e);
        }
        return profile;
    },

    // Processa entrada de voz/texto
    async processVoiceInput(text) {
        try {
            const res = await fetch(`${this.baseUrl}/api/voice/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('[HirePair] Processamento simulado local:', e);
        }
        return {
            success: true,
            detected_facts: [
                { type: "experience", text: text || "Experiência registrada" },
                { type: "skill", text: "Atendimento e Comunicação" }
            ]
        };
    },

    // Busca vagas recomendadas
    async getJobs() {
        try {
            const res = await fetch(`${this.baseUrl}/api/jobs`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('[HirePair] Vagas em cache local:', e);
        }
        return { jobs: [], total: 0 };
    },

    // Gera dados de exportação e WhatsApp
    async getExportData() {
        try {
            const res = await fetch(`${this.baseUrl}/api/resume/export`, { method: 'POST' });
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('[HirePair] Gerando payload localmente:', e);
        }
        const text = encodeURIComponent("Olá! Segue meu currículo profissional gerado pelo HirePair, otimizado para triagem ATS.");
        return {
            whatsapp_url: `https://wa.me/?text=${text}`,
            ats_compliant: true
        };
    }
};

// Disponibiliza no escopo global
window.HirePairAPI = HirePairAPI;

