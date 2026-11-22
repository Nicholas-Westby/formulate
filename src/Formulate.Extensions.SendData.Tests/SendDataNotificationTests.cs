using System.Net;
using Formulate.Extensions.SendData.Notifications;
using Formulate.Extensions.SendData.Tests.TestSupport;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Events;
using static Formulate.Extensions.SendData.Tests.TestSupport.TestForms;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// The notifications a site hooks into, published by Umbraco's real notification publisher.
/// </summary>
public sealed class SendDataNotificationTests
{
    private readonly PersistedFormField _name = Field("Name", TextKind, "name");

    private object Config => new
    {
        url = "http://hook.test/in",
        method = "POST",
        transmissionFormat = "JSON",
        fields = new[] { new { id = _name.Id.ToString("N"), name = "name" } },
    };

    private FormSubmissionRequest Submission() => Submit(TestForms.Form(_name)).Value(_name, "Ann").Build();

    [Fact]
    public async Task Cancelled_by_notification_sends_nothing()
    {
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SendingDataNotification>>(new DelegateHandler<SendingDataNotification>(n => n.Cancel = true)));

        await services.SendAsync(Config, Submission());

        Assert.Empty(services.Network.Requests);
        Assert.Empty(services.Logs.Errors);
    }

    [Fact]
    public async Task Notification_can_change_the_data_before_sending()
    {
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SendingDataNotification>>(new DelegateHandler<SendingDataNotification>(n =>
            {
                Assert.Equal("http://hook.test/in", n.Url);
                n.Data.Add(new KeyValuePair<string, string>("token", "abc"));
                n.Data[0] = new KeyValuePair<string, string>("name", "Changed");
                n.Headers["X-Api-Key"] = "k1";
            })));

        await services.SendAsync(Config, Submission());

        var request = services.Network.Single;
        Assert.Equal("{\"name\":\"Changed\",\"token\":\"abc\"}", request.Body);
        Assert.Equal("k1", request.Headers["X-Api-Key"]);
    }

    [Fact]
    public async Task Sent_notification_carries_the_status_code_and_body()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));
        services.Network.Status = HttpStatusCode.Created;
        services.Network.ResponseBody = "{\"id\":7}";

        await services.SendAsync(Config, Submission());

        Assert.NotNull(seen);
        Assert.Equal(HttpStatusCode.Created, seen.StatusCode);
        Assert.Equal("{\"id\":7}", seen.ResponseBody);
        Assert.True(seen.IsSuccess);
        Assert.Null(seen.Error);
        Assert.Equal("http://hook.test/in", seen.Url);
        Assert.Equal("Contact Us", seen.Request.Form.Name);
    }

    [Fact]
    public async Task Sent_notification_reports_a_failed_request_without_a_status()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));
        services.Network.Failure = new HttpRequestException("refused");

        await services.SendAsync(Config, Submission());

        Assert.NotNull(seen);
        Assert.Null(seen.StatusCode);
        Assert.False(seen.IsSuccess);
        Assert.IsType<HttpRequestException>(seen.Error);
    }

    [Fact]
    public async Task Sent_notification_for_an_error_status_is_not_a_success()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));
        services.Network.Status = HttpStatusCode.BadRequest;
        services.Network.ResponseBody = "nope";

        await services.SendAsync(Config, Submission());

        Assert.NotNull(seen);
        Assert.Equal(HttpStatusCode.BadRequest, seen.StatusCode);
        Assert.Equal("nope", seen.ResponseBody);
        Assert.False(seen.IsSuccess);
    }

    [Fact]
    public async Task Notification_handler_that_throws_does_not_escape()
    {
        await using var services = SendDataTestServices.Create(x =>
        {
            x.AddSingleton<INotificationHandler<SendingDataNotification>>(new DelegateHandler<SendingDataNotification>(_ => throw new InvalidOperationException("bad site code")));
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(_ => throw new InvalidOperationException("bad site code")));
        });

        await services.SendAsync(Config, Submission());

        // A throwing SendingDataNotification handler sends nothing; the error names the handler.
        Assert.Empty(services.Network.Requests);
        Assert.Contains("Send to the CRM", Assert.Single(services.Logs.Errors).Message);
    }

    [Fact]
    public async Task Sent_notification_keeps_at_most_one_mebibyte_of_the_body_and_says_so()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));
        services.Network.ResponseBody = new string('a', 1_048_576 + 100);

        await services.SendAsync(Config, Submission());

        Assert.NotNull(seen);
        Assert.Equal(HttpStatusCode.OK, seen.StatusCode);
        Assert.Equal(1_048_576, seen.ResponseBody!.Length);
        Assert.True(seen.IsBodyTruncated);
    }

    [Fact]
    public async Task Sent_notification_with_a_body_of_exactly_the_limit_is_not_truncated()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));
        services.Network.ResponseBody = new string('a', 1_048_576);

        await services.SendAsync(Config, Submission());

        Assert.NotNull(seen);
        Assert.Equal(1_048_576, seen.ResponseBody!.Length);
        Assert.False(seen.IsBodyTruncated);
    }

    [Fact]
    public async Task Sent_notification_decodes_the_body_by_its_charset()
    {
        SentDataNotification? seen = null;
        await using var services = SendDataTestServices.Create(x =>
            x.AddSingleton<INotificationHandler<SentDataNotification>>(new DelegateHandler<SentDataNotification>(n => seen = n)));
        services.Network.ResponseBody = "caf\u00e9";
        services.Network.ResponseEncoding = System.Text.Encoding.Latin1;

        await services.SendAsync(Config, Submission());

        Assert.Equal("caf\u00e9", seen!.ResponseBody);
    }
}
