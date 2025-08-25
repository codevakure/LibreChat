import { pleach } from 'pleach-data-provider';
import type { DynamicSettingProps } from 'pleach-data-provider';

type PleachKeys = keyof typeof pleach;

type PleachParams = {
  modelOptions: Omit<NonNullable<DynamicSettingProps['conversation']>, PleachKeys>;
  resendFiles: boolean;
  promptPrefix?: string | null;
  maxContextTokens?: number;
  modelLabel?: string | null;
};

/**
 * Separates Pleach-specific parameters from model options
 * @param options - The combined options object
 */
export function extractPleachParams(
  options?: DynamicSettingProps['conversation'],
): PleachParams {
  if (!options) {
    return {
      modelOptions: {} as Omit<NonNullable<DynamicSettingProps['conversation']>, PleachKeys>,
      resendFiles: pleach.resendFiles.default as boolean,
    };
  }

  const modelOptions = { ...options };

  const resendFiles =
    (delete modelOptions.resendFiles, options.resendFiles) ??
    (pleach.resendFiles.default as boolean);
  const promptPrefix = (delete modelOptions.promptPrefix, options.promptPrefix);
  const maxContextTokens = (delete modelOptions.maxContextTokens, options.maxContextTokens);
  const modelLabel = (delete modelOptions.modelLabel, options.modelLabel);

  return {
    modelOptions: modelOptions as Omit<
      NonNullable<DynamicSettingProps['conversation']>,
      PleachKeys
    >,
    maxContextTokens,
    promptPrefix,
    resendFiles,
    modelLabel,
  };
}
