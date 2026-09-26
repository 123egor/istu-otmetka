export type AuthStatus = 'success' | 'wrong_credentials' | 'error' | 'timeout';

export type Account = {
  id: number;
  name: string;
  login: string;
  hasPassword: boolean;
};

export type BatchResultRow = {
  id: number;
  job_id: string;
  login: string;
  status: AuthStatus;
  result_url: string | null;
  page_title: string | null;
  message: string | null;
};
