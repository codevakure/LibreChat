import { wrangler } from 'wrangler-data-provider';
import type { DynamicSettingProps } from 'wrangler-data-provider';

type WranglerKeys = keyof typeof wrangler;

type WranglerParams = {
  modelOptions: Omit<NonNullable<DynamicSettingProps['conversation']>, WranglerKeys>;
  resendFiles: boolean;
  promptPrefix?: string | null;
  maxContextTokens?: number;
  modelLabel?: string | null;
};

/**
 * Separates Wrangler-specific parameters from model options
 * @param options - The combined options object
 */
export function extractWranglerParams(
  options?: DynamicSettingProps['conversation'],
): WranglerParams {
  if (!options) {
    return {
      modelOptions: {} as Omit<NonNullable<DynamicSettingProps['conversation']>, WranglerKeys>,
      resendFiles: wrangler.resendFiles.default as boolean,
    };
  }

  const modelOptions = { ...options };

  const resendFiles =
    (delete modelOptions.resendFiles, options.resendFiles) ??
    (wrangler.resendFiles.default as boolean);
  const promptPrefix = (delete modelOptions.promptPrefix, options.promptPrefix);
  const maxContextTokens = (delete modelOptions.maxContextTokens, options.maxContextTokens);
  const modelLabel = (delete modelOptions.modelLabel, options.modelLabel);

  return {
    modelOptions: modelOptions as Omit<
      NonNullable<DynamicSettingProps['conversation']>,
      WranglerKeys
    >,
    maxContextTokens,
    promptPrefix,
    resendFiles,
    modelLabel,
  };
}
