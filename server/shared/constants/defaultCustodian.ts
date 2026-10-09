// TODO: replace with the actual logged-in user's id once auth/session is wired up.
// asset_records.current_custodian is a required FK to users.user_id — the intake
// form doesn't collect this yet, so every asset is provisionally logged under this id.
export const DEFAULT_CUSTODIAN_ID = 1;
