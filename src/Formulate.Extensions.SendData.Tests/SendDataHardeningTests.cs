using System.Net;
using System.Net.Sockets;
using Formulate.Extensions.SendData.Notifications;
using Formulate.Extensions.SendData.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Events;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// What a site owner and a visitor are protected from: leaks in logs, redirects, bad settings.
/// </summary>
public sealed class SendDataHardeningTests
{
    private const string VisitorValue = "visitor-private-value";

    private readonly PersistedFormField _name = Field("Name", TextKind, "name");

    private readonly PersistedFormField _tags = Field("Tags", TextKind, "tags");

    private object Config(string url, string method = "GET", string format = "Query String") => new
    {
        url,
        method,
        transmissionFormat = format,
        fields = new[] { new { id = _name.Id.ToString("N"), name = "Name" } },
    };

    private FormSubmissionRequest Submission() => Submit(TestForms.Form(_name, _tags)).Value(_name, VisitorValue).Build();

    private static void AssertNothingLogged(SendDataTestServices services, params string[] secrets)
    {
        Assert.NotEmpty(services.Logs.Entries);

        foreach (var entry in services.Logs.Entries)
        {
            foreach (var secret in secrets)
            {
                Assert.DoesNotContain(secret, entry.Message);
                Assert.DoesNotContain(secret, entry.Exception?.ToString() ?? string.Empty);
            }
        }
    }

    [Theory]
    [InlineData(HttpStatusCode.OK)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.Found)]
    public async Task Query_string_send_leaves_the_visitors_values_and_the_urls_query_and_user_info_out_of_every_log(HttpStatusCode status)
    {
        await using var services = SendDataTestServices.Create();
        services.Network.Status = status;

        await services.SendAsync(Config("http://user:pw-secret@hook.test/in?key=api-secret"), Submission());

        AssertNothingLogged(services, VisitorValue, "api-secret", "pw-secret", "user:");
        Assert.Contains(services.Logs.Entries, x => x.Message.Contains("http://hook.test/in"));
    }

    [Fact]
    public async Task Failed_send_leaves_the_visitors_values_and_the_urls_secrets_out_of_every_log()
    {
        await using var services = SendDataTestServices.Create();
        services.Network.Failure = new HttpRequestException("refused");

        await services.SendAsync(Config("http://user:pw-secret@hook.test/in?key=api-secret"), Submission());

        AssertNothingLogged(services, VisitorValue, "api-secret", "pw-secret");
    }

    [Fact]
    public async Task Notifications_get_the_real_url()
    {
        string? sending = null;
        string? sent = null;
        await using var services = SendDataTestServices.Create(x =>
        {
            x.AddSingleton<INotificationHandler<SendingDataNotification>>(new DelegateHandler<SendingDataNotification>(n => sending = n.Url));
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => sent = n.Url));
        });

        await services.SendAsync(Config("http://hook.test/in?key=api-secret", "POST", "JSON"), Submission());

        Assert.Equal("http://hook.test/in?key=api-secret", sending);
        Assert.Equal("http://hook.test/in?key=api-secret", sent);
    }

    [Fact]
    public async Task Relative_url_sends_nothing_and_is_not_logged()
    {
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(Config("/hooks/in?key=api-secret"), Submission());

        Assert.Empty(services.Network.Requests);
        Assert.Single(services.Logs.Errors);
        AssertNothingLogged(services, "api-secret", "/hooks/in");
    }

    [Fact]
    public async Task Invalid_method_is_logged_and_nothing_escapes()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));

        await services.SendAsync(Config("http://hook.test/in", "NOT A METHOD", "JSON"), Submission());

        Assert.Empty(services.Network.Requests);
        Assert.Single(services.Logs.Errors);
        Assert.NotNull(seen?.Error);
        Assert.Null(seen.StatusCode);
    }

    [Fact]
    public async Task Mapped_field_that_was_not_posted_is_left_out()
    {
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = _tags.Id.ToString("N"), name = "Tags" }, new { id = _name.Id.ToString("N"), name = "Name" } },
        };
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(config, Submission());

        Assert.Equal("{\"Name\":\"" + VisitorValue + "\"}", services.Network.Single.Body);
    }

    [Fact]
    public async Task Mapping_id_that_is_not_a_guid_is_warned_about_and_left_out()
    {
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = "not-a-guid", name = "Bad" }, new { id = _name.Id.ToString("N"), name = "Name" } },
        };
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(config, Submission());

        Assert.Equal("{\"Name\":\"" + VisitorValue + "\"}", services.Network.Single.Body);
        Assert.Contains("not-a-guid", Assert.Single(services.Logs.Warnings).Message);
    }

    [Fact]
    public async Task Header_that_cannot_be_added_is_warned_about_without_its_value()
    {
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SendingDataNotification>>(new DelegateHandler<SendingDataNotification>(n =>
            {
                n.Headers["Bad Header Name"] = "header-secret";
                n.Headers["X-Api-Key"] = "ok";
            })));

        await services.SendAsync(Config("http://hook.test/in", "POST", "JSON"), Submission());

        Assert.Equal("ok", services.Network.Single.Headers["X-Api-Key"]);
        var warning = Assert.Single(services.Logs.Warnings);
        Assert.Contains("Bad Header Name", warning.Message);
        Assert.DoesNotContain("header-secret", warning.Message);
    }

    [Fact]
    public async Task Text_constant_with_unreadable_data_sends_nothing_and_does_not_throw()
    {
        var constant = Field("Source", TextConstantKind, "source", "{not json");
        var form = TestForms.Form(_name, constant);
        var config = new
        {
            url = "http://hook.test/in",
            method = "POST",
            transmissionFormat = "JSON",
            fields = new[] { new { id = constant.Id.ToString("N"), name = "Source" } },
        };
        await using var services = SendDataTestServices.Create();

        await services.SendAsync(config, Submit(form).Value(_name, "x").Build());

        Assert.Empty(services.Network.Requests);
        Assert.Contains("could not be built", Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task Hubspot_sends_the_hutk_from_the_hubspotutk_cookie()
    {
        var http = new DefaultHttpContext();
        http.Request.Headers.Cookie = "other=1; hubspotutk=abc123";
        await using var services = SendDataTestServices.Create(x => x.AddSingleton<IHttpContextAccessor>(new HttpContextAccessor { HttpContext = http }));

        await services.SendAsync(Config("https://api.hubapi.test/submit", "POST", "HubSpot JSON"), Submission());

        Assert.Equal(
            "{\"fields\":[{\"name\":\"Name\",\"value\":\"" + VisitorValue + "\"}],\"context\":{\"hutk\":\"abc123\"}}",
            services.Network.Single.Body);
    }

    [Fact]
    public async Task Throwing_sent_handler_does_not_fail_the_submission()
    {
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(_ => throw new InvalidOperationException("bad site code"))));
        var recorder = new RecordingDefinition();
        var form = TestForms.Form(_name);
        form.Handlers = new[] { SendDataTestServices.Settings(services.Definition, SendDataTestServices.ToJson(Config("http://hook.test/in", "POST", "JSON"))), SendDataTestServices.Settings(recorder, null) };

        var result = await services.Runner(recorder).SubmitAsync(Submit(form).Value(_name, "Ann").Build(), TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccessful);
        Assert.Equal(1, recorder.Runs);
        Assert.Single(services.Network.Requests);
        Assert.Contains("SentDataNotification", Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task Redirect_is_not_followed_and_is_logged_at_information_with_the_locations_host_and_path()
    {
        // A real listener and the client as the composer registers it, since a fake cannot follow a redirect.
        var port = FreePort();
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();
        var hits = new List<string>();
        var serving = Task.Run(async () =>
        {
            while (listener.IsListening)
            {
                HttpListenerContext context;

                try
                {
                    context = await listener.GetContextAsync();
                }
                catch (Exception)
                {
                    return;
                }

                lock (hits)
                {
                    hits.Add(context.Request.RawUrl!);
                }

                context.Response.StatusCode = 302;
                context.Response.RedirectLocation = $"http://localhost:{port}/moved/here?token=loc-secret";
                context.Response.Close();
            }
        }, TestContext.Current.CancellationToken);
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(
            x => x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)),
            fakeNetwork: false);

        await services.SendAsync(Config($"http://localhost:{port}/in"), Submission());
        listener.Stop();
        await serving;

        lock (hits)
        {
            Assert.Equal(new[] { $"/in?Name={VisitorValue}" }, hits);
        }

        Assert.Equal(HttpStatusCode.Found, seen!.StatusCode);
        Assert.False(seen.IsSuccess);
        Assert.Empty(services.Logs.Errors);
        var info = Assert.Single(services.Logs.Entries, x => x.Message.Contains("302"));
        Assert.Equal(Microsoft.Extensions.Logging.LogLevel.Information, info.Level);
        Assert.Contains($"localhost:{port}/moved/here", info.Message);
        AssertNothingLogged(services, VisitorValue, "loc-secret");
    }

    private static int FreePort()
    {
        var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        var port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();

        return port;
    }
}
