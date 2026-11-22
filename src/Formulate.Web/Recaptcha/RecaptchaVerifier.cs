namespace Formulate.Web.Recaptcha
{
    using System.Buffers;
    using System.Text.Json;
    using Formulate.Core.FormFields.Recaptcha;

    /// <summary>
    /// Verifies reCAPTCHA response tokens with Google's siteverify endpoint.
    /// </summary>
    /// <remarks>
    /// The secret and the response go in a form body, never in the URL, so no log, proxy or error message
    /// can carry them. The visitor's IP address is not sent (it is optional). The request does not follow
    /// redirects, keeps no cookies, and is not logged by the HTTP client.
    /// </remarks>
    internal sealed class RecaptchaVerifier : IRecaptchaVerifier
    {
        /// <summary>
        /// The name of the HTTP client.
        /// </summary>
        internal const string HttpClientName = RecaptchaConstants.HttpClientName;

        /// <summary>
        /// Google's verification endpoint.
        /// </summary>
        internal const string Endpoint = "https://www.google.com/recaptcha/api/siteverify";

        /// <summary>
        /// The time the exchange may take, the reply included. The visitor waits for it.
        /// </summary>
        internal static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(10);

        /// <summary>
        /// The most of Google's reply that is read: 64 KB. Its answer is a few hundred bytes.
        /// </summary>
        internal const int MaxResponseBytes = 64 * 1024;

        private readonly IHttpClientFactory _httpClientFactory;

        private readonly TimeSpan _timeout;

        public RecaptchaVerifier(IHttpClientFactory httpClientFactory) : this(httpClientFactory, DefaultTimeout)
        {
        }

        internal RecaptchaVerifier(IHttpClientFactory httpClientFactory, TimeSpan timeout)
        {
            _httpClientFactory = httpClientFactory;
            _timeout = timeout;
        }

        /// <inheritdoc />
        public async Task<RecaptchaVerification> VerifyAsync(string secretKey, string token, CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("secret", secretKey),
                    new KeyValuePair<string, string>("response", token),
                })
            };

            // The time limit covers the whole exchange, the body included: HttpClient.Timeout ends at the
            // response headers when the body is read afterwards.
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            limit.CancelAfter(_timeout);

            using var response = await _httpClientFactory.CreateClient(HttpClientName)
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, limit.Token);

            response.EnsureSuccessStatusCode();

            var body = await ReadBodyAsync(response.Content, limit.Token);

            return Parse(body);
        }

        private static RecaptchaVerification Parse(byte[] body)
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;

            if (root.ValueKind != JsonValueKind.Object)
            {
                return new RecaptchaVerification(false, Array.Empty<string>());
            }

            // Only a boolean true is a pass: a string or number that looks like it is not.
            var success = root.TryGetProperty("success", out var flag) && flag.ValueKind == JsonValueKind.True;
            var codes = new List<string>();

            if (root.TryGetProperty("error-codes", out var errors) && errors.ValueKind == JsonValueKind.Array)
            {
                foreach (var error in errors.EnumerateArray())
                {
                    if (error.ValueKind == JsonValueKind.String)
                    {
                        codes.Add(error.GetString()!);
                    }
                }
            }

            return new RecaptchaVerification(success, codes);
        }

        private static async Task<byte[]> ReadBodyAsync(HttpContent content, CancellationToken cancellationToken)
        {
            await using var stream = await content.ReadAsStreamAsync(cancellationToken);
            using var bytes = new MemoryStream();
            var chunk = ArrayPool<byte>.Shared.Rent(4096);

            try
            {
                while (true)
                {
                    var read = await stream.ReadAsync(chunk.AsMemory(0, chunk.Length), cancellationToken);

                    if (read == 0)
                    {
                        break;
                    }

                    // One byte over the limit is enough to refuse the reply, without reading the rest.
                    if (bytes.Length + read > MaxResponseBytes)
                    {
                        throw new InvalidDataException($"The reCAPTCHA reply is over {MaxResponseBytes} bytes.");
                    }

                    bytes.Write(chunk, 0, read);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(chunk);
            }

            return bytes.ToArray();
        }
    }
}
