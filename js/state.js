// Central runtime state — no localStorage, all data comes from the backend API
export const state = {
    currentUser: null,
    products: [],
    requests: [],
    logs: [],
    locations: [],
    pipeCategories: [],
    pipeColumns: ['4KG', '6KG', '10KG', '15KG', 'SLOTTED'],
};
