using Formulate.Extensions.SendData.Tests.TestSupport;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Formulate.Extensions.SendData.Tests;

/// <summary>
/// The named client as the composer registers it, built by the real IHttpClientFactory.
/// </summary>
public sealed class SendDataClientTests
{
    private static ServiceProvider Build()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddFormulateSendData();

        return services.BuildServiceProvider();
    }

    private static IEnumerable<HttpMessageHandler> Chain(HttpMessageHandler handler)
    {
        for (var current = handler; current is not null; current = (current as DelegatingHandler)?.InnerHandler!)
        {
            yield return current;
        }
    }

    [Fact]
    public async Task Client_does_not_keep_cookies_or_follow_redirects_and_times_out_after_30_seconds()
    {
        await using var provider = Build();

        var chain = Chain(provider.GetRequiredService<IHttpMessageHandlerFactory>().CreateHandler(Constants.HttpClientName)).ToArray();
        var primary = Assert.IsType<SocketsHttpHandler>(chain[^1]);

        // One visitor's request must not carry cookies the receiver set for another's.
        Assert.False(primary.UseCookies);
        Assert.False(primary.AllowAutoRedirect);
        Assert.Equal(TimeSpan.FromSeconds(30), provider.GetRequiredService<IHttpClientFactory>().CreateClient(Constants.HttpClientName).Timeout);

        // Microsoft's logging handlers write the full URL, and for Query String that is the visitor's data.
        Assert.DoesNotContain(chain, x => x.GetType().Name.Contains("Logging"));
    }
}
