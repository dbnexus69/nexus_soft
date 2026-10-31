export { login, logout, getMe } from './auth';
export type { LoginResponse } from './auth';
export {
  listUsers, getUser, createUser, updateUser, deleteUser,
  updateRolePermissions, getRolePermissions, getMyPermissions, getRolesSchema,
} from './users';
export {
  listClients, getClient, createClient, updateClient, toggleClientStatus, suggestDestinations,
} from './clients';
export {
  listResponsables, getResponsable, createResponsable, updateResponsable, setResponsableStatus, deleteResponsable,
} from './responsables';
export {
  listSales, getSale, getCreditPortfolio, getClientCredits, getSaleProducts, getSaleProductsByCategory, createSale, updateSale, deleteSale, voidSale,
  registerPayment, deletePayment, getSalePayments, uploadProductVoucher,
  sendVoucher, getVoucherUrl, updateReviewStatus,
} from './sales';
export {
  listFlights, listCheckins, updateCheckin, cancelCheckin,
} from './flights';
export {
  listCommissionAgents, createCommissionAgent, updateCommissionAgent, deleteCommissionAgent,
  listSettlements, createSettlement,
} from './commissions';
export {
  listQuotes, getQuote, createQuote, updateQuote, deleteQuote, duplicateQuote,
  sendQuote, respondQuote, convertQuoteToSale, linkQuoteSale, getQuotePdfUrl,
  uploadQuoteLineImage, deleteQuoteLineImage,
} from './quotes';
export type { QuoteDraft } from './quotes';
export {
  getAllConfig, getConfigSection, getConfigItem, createConfigItem, updateConfigItem, deleteConfigItem,
} from './config';
export {
  getDashboard, getAttention, getAsesorPerformance, getCreditBreakdown,
  getTopClients, getCategoryDistribution, getIva,
} from './stats';

// Empresas: solo el superadministrador. `getBranding` la usa cualquiera.
export {
  listCompanies, getCompany, createCompany, updateCompany, uploadCompanyLogo, getBranding,
  startImpersonation, stopImpersonation,
} from './companies';
export type { Empresa, NuevaEmpresa } from './companies';
export { getCompanyProfile, updateCompanyProfile, uploadCompanyProfileLogo, previewVoucher } from './companyProfile';
export type { PerfilEmpresa, CambiosPerfil, Clausula } from './companyProfile';
