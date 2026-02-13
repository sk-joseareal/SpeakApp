export interface P4w4PluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  reverse(options: { value: string }): Promise<{ value: string }>;
  resizeWebView(options: { offset: number }): Promise<void>;
  offsetTopWebView(options: { offset: number }): Promise<void>;
  getStatusBarHeight(): Promise<{ height: number }>;
  setStartupHtml(options: { file: string }): Promise<void>;
  resetBadgeCount(): Promise<void>;
}
