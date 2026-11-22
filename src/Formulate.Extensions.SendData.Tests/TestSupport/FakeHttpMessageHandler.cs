using System.Net;
using System.Text;

namespace Formulate.Extensions.SendData.Tests.TestSupport;

/// <summary>
/// Stands in for the network: remembers every request and answers with a set response or failure.
/// </summary>
internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly List<ReceivedRequest> _requests = new();

    public IReadOnlyList<ReceivedRequest> Requests => _requests;

    public ReceivedRequest Single => Assert.Single(_requests);

    /// <summary>
    /// Gets or sets the status to answer with.
    /// </summary>
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;

    /// <summary>
    /// Gets or sets the body to answer with.
    /// </summary>
    public string ResponseBody { get; set; } = "ok";

    /// <summary>
    /// Gets or sets the encoding of the body, which is also its charset.
    /// </summary>
    public Encoding ResponseEncoding { get; set; } = Encoding.UTF8;

    /// <summary>
    /// Gets or sets the exact bytes to answer with instead of <see cref="ResponseBody"/>, with the charset utf-8 declared.
    /// </summary>
    public byte[]? ResponseBytes { get; set; }

    /// <summary>
    /// Gets the headers to add to the response, added without validation.
    /// </summary>
    public Dictionary<string, string> ResponseHeaders { get; } = new();

    /// <summary>
    /// Gets or sets a failure to throw instead of answering.
    /// </summary>
    public Exception? Failure { get; set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);

        _requests.Add(new ReceivedRequest(
            request.Method.Method,
            request.RequestUri!.PathAndQuery,
            request.RequestUri.ToString(),
            request.Content?.Headers.ContentType?.ToString(),
            request.Content?.Headers.ContentLength,
            body,
            request.Headers.ToDictionary(x => x.Key, x => string.Join(",", x.Value))));

        if (Failure is not null)
        {
            throw Failure;
        }

        var response = new HttpResponseMessage(Status) { Content = new StringContent(ResponseBody, ResponseEncoding, "text/plain") };

        if (ResponseBytes is not null)
        {
            response.Content = new ByteArrayContent(ResponseBytes);
            response.Content.Headers.TryAddWithoutValidation("Content-Type", "text/plain; charset=utf-8");
        }

        foreach (var header in ResponseHeaders)
        {
            response.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        return response;
    }
}

internal sealed record ReceivedRequest(
    string Method,
    string PathAndQuery,
    string Url,
    string? ContentType,
    long? ContentLength,
    string? Body,
    Dictionary<string, string> Headers)
{
    /// <summary>
    /// The request line: the method and the path and query.
    /// </summary>
    public string RequestLine => $"{Method} {PathAndQuery}";
}
