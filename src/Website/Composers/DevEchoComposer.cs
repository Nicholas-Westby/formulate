using System.Net;
using System.Text;
using System.Text.Json;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Web.Common.ApplicationBuilder;

namespace Website.Composers;

/// <summary>
/// An address on the dev site, /dev/echo/ and anything under it, that takes any request from localhost and
/// writes it to a file in DevEcho:Folder: its method, path, query string, headers and body. It answers 200 with
/// what it wrote.
/// </summary>
/// <remarks>
/// It gives a Send Data handler somewhere to send to. The end-to-end tests point handlers at it, on the site's
/// plain http address so the handler needs no trusted certificate, and read the files to see what each
/// handler sent. The files are named by the time each request arrived, so they sort in that order. A relative
/// folder is taken from the site's folder (src/Website). It runs only in the Development environment and is
/// never packed.
///
/// So that its files hold no secrets and cannot fill the disk, it writes a cookie or authorization header as
/// "(redacted)", answers 413 to a body of more than <see cref="DevEcho.MaxBodyBytes"/>, and answers 404 to a
/// request from any address but a loopback one, even when the site listens on other addresses than localhost.
///
/// It answers at the start of the pipeline, before Umbraco routes the request: by the time an endpoint runs,
/// Umbraco's routing has read the body of a form post, and the echo would find it empty.
/// </remarks>
public sealed class DevEchoComposer : IComposer
{
    /// <summary>The address the echo answers on, and under.</summary>
    public const string Route = "/dev/echo";

    public void Compose(IUmbracoBuilder builder)
    {
        // The host registers its environment as an instance, so it can be read while composing.
        var environment = builder.Services
            .Select(x => x.ImplementationInstance)
            .OfType<IHostEnvironment>()
            .FirstOrDefault();

        if (environment is null || !environment.IsDevelopment())
        {
            return;
        }

        var folder = Path.GetFullPath(builder.Config["DevEcho:Folder"] ?? "umbraco/Data/Echo", environment.ContentRootPath);

        builder.Services.AddSingleton(new DevEchoFolder(folder));
        builder.Services.Configure<UmbracoPipelineOptions>(options => options.AddFilter(new UmbracoPipelineFilter(nameof(DevEchoComposer))
        {
            PrePipeline = app => app.Use(async (context, next) =>
            {
                if (context.Request.Path.StartsWithSegments(Route))
                {
                    await DevEcho.HandleAsync(context);
                    return;
                }

                await next(context);
            }),
        }));
        builder.AddNotificationHandler<UmbracoApplicationStartingNotification, DevEchoStarting>();
    }
}

/// <summary>
/// The folder the echo writes to.
/// </summary>
public sealed record DevEchoFolder(string Path);

/// <summary>
/// A request the echo received, as it writes it (tests/e2e/support/echo.ts reads it).
/// </summary>
public sealed record DevEchoRecord(
    DateTimeOffset ReceivedAt,
    string Method,
    string Path,
    string Query,
    IReadOnlyDictionary<string, string> Headers,
    string Body);

/// <summary>
/// Writes each request to a file, and answers with what it wrote.
/// </summary>
public static class DevEcho
{
    /// <summary>The most of a request's body that the echo takes: 1 MiB.</summary>
    public const int MaxBodyBytes = 1024 * 1024;

    /// <summary>What the echo writes for the value of a header in <see cref="RedactedHeaders"/>.</summary>
    public const string Redacted = "(redacted)";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    /// <summary>The headers whose values the echo does not write, as they can hold a session or a password.</summary>
    private static readonly HashSet<string> RedactedHeaders = new(StringComparer.OrdinalIgnoreCase) { "cookie", "authorization" };

    public static async Task HandleAsync(HttpContext context)
    {
        var request = context.Request;
        var folder = context.RequestServices.GetRequiredService<DevEchoFolder>().Path;
        var logger = context.RequestServices.GetRequiredService<ILogger<DevEchoFolder>>();
        var path = (request.PathBase + request.Path).Value ?? string.Empty;

        if (!IsFromLoopback(context.Connection.RemoteIpAddress))
        {
            logger.LogWarning(
                "The dev site's echo answered 404 to {Method} {Path} from {RemoteAddress}, as it takes requests from localhost only.",
                request.Method,
                path,
                context.Connection.RemoteIpAddress);
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var body = await ReadBodyAsync(request, context.RequestAborted);

        if (body is null)
        {
            logger.LogWarning(
                "The dev site's echo answered 413 to {Method} {Path}, as its body is longer than {MaxBodyBytes} bytes.",
                request.Method,
                path,
                MaxBodyBytes);
            context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
            return;
        }

        var record = new DevEchoRecord(
            DateTimeOffset.UtcNow,
            request.Method,
            path,
            request.QueryString.Value ?? string.Empty,
            request.Headers.ToDictionary(
                x => x.Key.ToLowerInvariant(),
                x => RedactedHeaders.Contains(x.Key) ? Redacted : string.Join(", ", x.Value.ToArray())),
            body);
        var json = JsonSerializer.Serialize(record, JsonOptions);

        // Written under another name first, then renamed, so a reader never finds half a file.
        var name = $"{record.ReceivedAt:yyyyMMddHHmmssfffffff}-{Guid.NewGuid():N}.json";
        var file = Path.Combine(folder, name);
        Directory.CreateDirectory(folder);
        await File.WriteAllTextAsync(file + ".partial", json, context.RequestAborted);
        File.Move(file + ".partial", file);

        logger.LogInformation("The dev site's echo got {Method} {Path} and wrote it to {DevEchoFile}.", record.Method, record.Path, file);

        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsync(json, context.RequestAborted);
    }

    /// <summary>
    /// Whether a request came from a loopback address (localhost), also as IPv6 writes an IPv4 one.
    /// </summary>
    private static bool IsFromLoopback(IPAddress? address)
    {
        return address is not null && IPAddress.IsLoopback(address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address);
    }

    /// <summary>
    /// Reads the body as UTF-8 text.
    /// </summary>
    /// <returns>The body; or null when it is longer than <see cref="MaxBodyBytes"/>, which is read no further.</returns>
    private static async Task<string?> ReadBodyAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength > MaxBodyBytes)
        {
            return null;
        }

        // A body sent in chunks has no length to check first.
        using var bytes = new MemoryStream();
        var buffer = new byte[16 * 1024];
        int read;

        while ((read = await request.Body.ReadAsync(buffer, cancellationToken)) > 0)
        {
            if (bytes.Length + read > MaxBodyBytes)
            {
                return null;
            }

            bytes.Write(buffer, 0, read);
        }

        bytes.Position = 0;
        using var reader = new StreamReader(bytes, Encoding.UTF8);
        return await reader.ReadToEndAsync(cancellationToken);
    }
}

/// <summary>
/// Makes the folder while Umbraco starts, and says where the echo is.
/// </summary>
public sealed class DevEchoStarting(DevEchoFolder folder, ILogger<DevEchoStarting> logger)
    : INotificationHandler<UmbracoApplicationStartingNotification>
{
    public void Handle(UmbracoApplicationStartingNotification notification)
    {
        Directory.CreateDirectory(folder.Path);

        logger.LogInformation(
            "The dev site's echo answers on {DevEchoRoute} and writes each request it gets to {DevEchoFolder}.",
            DevEchoComposer.Route,
            folder.Path);
    }
}
