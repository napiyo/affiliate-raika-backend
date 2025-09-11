// Enum for user roles to prevent typos
export const Role = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
});

// Enum for user roles to prevent typos
export const LeadSource = Object.freeze({
  link: 'affiliate-link',
  manual: 'affiliate-manual',
});

export const TRANSACTIONS_TYPES = ["CREDIT", "DEBIT", "WITHDRAWAL" , 'LOYALITY_POINT_CREDIT','LOYALITY_POINT_DEBIT'];
export const TRANSACTIONS_ENUM = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  WITHDRAWAL:'WITHDRAWAL',
  LOYALITY_POINT_CREDIT:'LOYALITY_POINT_CREDIT',
  LOYALITY_POINT_DEBIT:'LOYALITY_POINT_DEBIT'


});
export const USER_ROLES = ["admin", "user"];


export const InProgressStatus = ['RNR','Hot','Follow up','Cold','Shoot Postponed','Shoot Scheduled','3d Casting Booked','3d Casting Done','Milestone Package']