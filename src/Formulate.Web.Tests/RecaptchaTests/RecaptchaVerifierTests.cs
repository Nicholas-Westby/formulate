namespace Formulate.Web.Tests.RecaptchaTests
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Net;
    using System.Net.Http;
    using System.Text;
    using System.Threading;
    using System.Threading.Tasks;
    using Formulate.Core.FormFields.Recaptcha;
    using Formulate.Web.DependencyInjection;
    using Formulate.Web.Recaptcha;
    using Microsoft.Extensions.DependencyInjection;
    using Xunit;

    /// <summary>
    /// The real verifier, with a fake network under the named client the composer registers.
    /// </summary>
    public class RecaptchaVerifierTests
    {
        private readonly FakeNetwork _network = new();

        private ServiceProvider Build()
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddFormulateRecaptcha();

            // Only the network is replaced; the rest of the client is as registered.
            services.AddHttpClient(RecaptchaVerifier.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => _network);

            return services.BuildServiceProvider();
        }

        [Fact]
        public async Task The_secret_and_token_go_in_a_form_body_and_nothing_goes_in_the_url()
        {
            await using var provider = Build();

            var result = await provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("s3cret &=key", "tok en+/=", TestContext.Current.CancellationToken);

            Assert.True(result.Success);
            var request = Assert.Single(_network.Requests);
            Assert.Equal("POST", request.Method);
            Assert.Equal("https://www.google.com/recaptcha/api/siteverify", request.Url);
            Assert.Equal("application/x-www-form-urlencoded", request.ContentType);
            Assert.DoesNotContain("s3cret", request.Url);
            Assert.DoesNotContain("tok", request.Url);

            // Only the secret and the response are sent: no visitor IP.
            var fields = request.Body.Split('&').Select(x => x.Split('=')).ToDictionary(x => x[0], x => WebUtility.UrlDecode(x[1]));
            Assert.Equal(new[] { "response", "secret" }, fields.Keys.Order().ToArray());
            Assert.Equal("s3cret &=key", fields["secret"]);
            Assert.Equal("tok en+/=", fields["response"]);
            Assert.False(request.Headers.ContainsKey("Authorization"));
        }

        [Fact]
        public async Task Google_saying_no_gives_its_error_codes()
        {
            _network.ResponseBody = "{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\",\"invalid-input-secret\"]}";
            await using var provider = Build();

            var result = await provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken);

            Assert.False(result.Success);
            Assert.Equal(new[] { "timeout-or-duplicate", "invalid-input-secret" }, result.ErrorCodes);
        }

        [Theory]
        [InlineData("{\"success\":\"true\"}")]
        [InlineData("{\"success\":1}")]
        [InlineData("{}")]
        [InlineData("[]")]
        [InlineData("null")]
        public async Task Only_a_boolean_true_is_a_pass(string body)
        {
            _network.ResponseBody = body;
            await using var provider = Build();

            var result = await provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken);

            Assert.False(result.Success);
        }

        [Theory]
        [InlineData("not json")]
        [InlineData("")]
        public async Task A_reply_that_is_not_json_is_a_failure_to_verify(string body)
        {
            _network.ResponseBody = body;
            await using var provider = Build();

            await Assert.ThrowsAnyAsync<Exception>(() => provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken));
        }

        [Fact]
        public async Task A_failure_status_is_a_failure_to_verify()
        {
            _network.Status = HttpStatusCode.InternalServerError;
            await using var provider = Build();

            await Assert.ThrowsAsync<HttpRequestException>(() => provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken));
        }

        [Fact]
        public async Task An_unreachable_google_is_a_failure_to_verify()
        {
            _network.Failure = new HttpRequestException("no route");
            await using var provider = Build();

            await Assert.ThrowsAsync<HttpRequestException>(() => provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken));
        }

        [Fact]
        public async Task A_reply_over_64_kb_is_refused_without_reading_it_all()
        {
            // A reply that never ends: reading it all would never finish.
            var endless = new EndlessContent();
            _network.Content = endless;
            await using var provider = Build();

            await Assert.ThrowsAsync<System.IO.InvalidDataException>(() => provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken));

            // The limit is 64 KB; the reader stops within a chunk or two of it.
            Assert.InRange(endless.BytesRead, RecaptchaVerifier.MaxResponseBytes, RecaptchaVerifier.MaxResponseBytes + 16 * 1024);
        }

        [Fact]
        public async Task A_reply_just_over_64_kb_is_refused_and_one_at_the_limit_is_read()
        {
            _network.ResponseBody = "{\"success\":true,\"padding\":\"" + new string('x', RecaptchaVerifier.MaxResponseBytes) + "\"}";
            await using var provider = Build();

            await Assert.ThrowsAsync<System.IO.InvalidDataException>(() => provider.GetRequiredService<IRecaptchaVerifier>().VerifyAsync("k", "t", TestContext.Current.CancellationToken));
        }

        [Fact]
        public async Task A_reply_that_stalls_after_the_headers_times_out()
        {
            // The time limit covers the body too, not only the headers.
            _network.StallBody = true;
            await using var provider = Build();
            var verifier = new RecaptchaVerifier(provider.GetRequiredService<IHttpClientFactory>(), TimeSpan.FromMilliseconds(200));

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => verifier.VerifyAsync("k", "t", TestContext.Current.CancellationToken));
        }

        private static IEnumerable<HttpMessageHandler> Chain(HttpMessageHandler handler)
        {
            for (var current = handler; current is not null; current = (current as DelegatingHandler)?.InnerHandler)
            {
                yield return current;
            }
        }

        [Fact]
        public async Task Client_does_not_keep_cookies_or_follow_redirects_and_times_out_after_10_seconds()
        {
            // The client as registered, without the fake network.
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddFormulateRecaptcha();
            await using var provider = services.BuildServiceProvider();

            var chain = Chain(provider.GetRequiredService<IHttpMessageHandlerFactory>().CreateHandler(RecaptchaVerifier.HttpClientName)).ToArray();
            var primary = Assert.IsType<SocketsHttpHandler>(chain[^1]);

            // One visitor's request must not carry cookies Google set for another's.
            Assert.False(primary.UseCookies);
            Assert.False(primary.AllowAutoRedirect);
            Assert.Equal(TimeSpan.FromSeconds(10), provider.GetRequiredService<IHttpClientFactory>().CreateClient(RecaptchaVerifier.HttpClientName).Timeout);
            Assert.Equal("Formulate.Recaptcha", RecaptchaVerifier.HttpClientName);

            // Microsoft's logging handlers write URLs.
            Assert.DoesNotContain(chain, x => x.GetType().Name.Contains("Logging"));
        }

        private sealed class FakeNetwork : HttpMessageHandler
        {
            public List<Received> Requests { get; } = new();

            public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;

            public string ResponseBody { get; set; } = "{\"success\":true}";

            public Exception? Failure { get; set; }

            public bool StallBody { get; set; }

            public HttpContent? Content { get; set; }

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
                Requests.Add(new Received(
                    request.Method.Method, request.RequestUri!.ToString(), request.Content?.Headers.ContentType?.MediaType ?? string.Empty, body,
                    request.Headers.ToDictionary(x => x.Key, x => string.Join(",", x.Value))));

                if (Failure is not null)
                {
                    throw Failure;
                }

                if (Content is not null)
                {
                    return new HttpResponseMessage(Status) { Content = Content };
                }

                if (StallBody)
                {
                    return new HttpResponseMessage(Status) { Content = new StallingContent() };
                }

                return new HttpResponseMessage(Status) { Content = new StringContent(ResponseBody, Encoding.UTF8, "application/json") };
            }
        }

        private sealed record Received(string Method, string Url, string ContentType, string Body, Dictionary<string, string> Headers);

        /// <summary>
        /// Content that never ends, and counts what was read from it.
        /// </summary>
        private sealed class EndlessContent : HttpContent
        {
            public long BytesRead { get; private set; }

            protected override Task SerializeToStreamAsync(System.IO.Stream stream, TransportContext? context) => throw new NotSupportedException();

            protected override Task<System.IO.Stream> CreateContentReadStreamAsync() => Task.FromResult<System.IO.Stream>(new EndlessStream(this));

            protected override bool TryComputeLength(out long length)
            {
                length = -1;

                return false;
            }

            private sealed class EndlessStream(EndlessContent owner) : System.IO.Stream
            {
                public override bool CanRead => true;
                public override bool CanSeek => false;
                public override bool CanWrite => false;
                public override long Length => throw new NotSupportedException();
                public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
                public override void Flush() { }
                public override long Seek(long offset, System.IO.SeekOrigin origin) => throw new NotSupportedException();
                public override void SetLength(long value) => throw new NotSupportedException();
                public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

                public override int Read(byte[] buffer, int offset, int count)
                {
                    Array.Fill(buffer, (byte)'x', offset, count);
                    owner.BytesRead += count;

                    return count;
                }

                public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
                {
                    buffer.Span.Fill((byte)'x');
                    owner.BytesRead += buffer.Length;

                    return new ValueTask<int>(buffer.Length);
                }
            }
        }

        /// <summary>
        /// Content whose body never arrives.
        /// </summary>
        private sealed class StallingContent : HttpContent
        {
            protected override async Task SerializeToStreamAsync(System.IO.Stream stream, TransportContext? context)
            {
                await Task.Delay(Timeout.Infinite);
            }

            protected override async Task<System.IO.Stream> CreateContentReadStreamAsync(CancellationToken cancellationToken)
            {
                await Task.Delay(Timeout.Infinite, cancellationToken);

                return System.IO.Stream.Null;
            }

            protected override bool TryComputeLength(out long length)
            {
                length = -1;

                return false;
            }
        }
    }
}
