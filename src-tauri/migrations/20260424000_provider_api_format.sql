-- Add api_format column to providers.
-- Values: 'openai' (default) or 'anthropic'.
-- This lets custom/gateway providers opt into the Anthropic message format
-- which enables prompt caching and correct content-block serialisation.
ALTER TABLE providers ADD COLUMN api_format TEXT NOT NULL DEFAULT 'openai';

-- Built-in providers that already use Anthropic format
UPDATE providers SET api_format = 'anthropic' WHERE provider_type IN ('anthropic', 'enowxlabs');
