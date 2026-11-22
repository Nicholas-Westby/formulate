using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Microsoft.Extensions.Logging;
using Formulate.BackOffice.Tests.TestSupport;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class ConfigurationJsonTests
{
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    private ConfigurationJson Create() => new(new RepositoryHarness().JsonUtility, _logger);

    private sealed class TypedConfiguration
    {
        [System.Runtime.Serialization.DataMember(Name = "autoPopulate")]
        public bool AutoPopulate { get; set; } = true;

        public int Count { get; set; } = 3;
    }

    [Fact]
    public void A_typed_definition_object_is_serialized_through_the_json_utility_as_an_object()
    {
        var result = Create().FromDefinition(() => new TypedConfiguration(), "{\"ignored\":true}", "form 'x'", "field 'y'");

        Assert.Equal(JsonValueKind.Object, result!.Value.ValueKind);
        Assert.Equal(3, result.Value.GetProperty("Count").GetInt32());
        Assert.False(result.Value.TryGetProperty("ignored", out _));
        Assert.Empty(_logger.Entries);
    }

    [Fact]
    public void A_definition_that_throws_falls_back_to_the_stored_json_and_warns_naming_the_entity()
    {
        var result = Create().FromDefinition(() => throw new InvalidOperationException("boom"), "{\"stored\":1}", "form 'Contact'", "field 'Email'");

        Assert.Equal("{\"stored\":1}", result!.Value.GetRawText());
        var warning = Assert.Single(_logger.Entries);
        Assert.Equal(LogLevel.Warning, warning.Level);
        Assert.Contains("form 'Contact'", warning.Message);
        Assert.Contains("field 'Email'", warning.Message);
        Assert.IsType<InvalidOperationException>(warning.Exception);
    }

    [Fact]
    public void A_definition_that_throws_with_invalid_stored_json_returns_the_text_as_a_string()
    {
        var result = Create().FromDefinition(() => throw new InvalidOperationException("boom"), "{bad", "form 'Contact'", "field 'Email'");

        Assert.Equal("{bad", result!.Value.GetString());
        Assert.Equal(2, _logger.Entries.Count(x => x.Level == LogLevel.Warning));
    }

    [Fact]
    public void A_definition_returning_nothing_uses_the_stored_json()
    {
        var result = Create().FromDefinition(() => null, "[1,2]", "form 'x'", "field 'y'");

        Assert.Equal("[1,2]", result!.Value.GetRawText());
    }

    [Fact]
    public void To_stored_maps_null_and_json_null_to_nothing_and_keeps_other_values()
    {
        Assert.Null(ConfigurationJson.ToStored(null));
        Assert.Null(ConfigurationJson.ToStored(JsonDocument.Parse("null").RootElement));
        Assert.Equal("{\"a\":[1]}", ConfigurationJson.ToStored(JsonDocument.Parse("{\"a\":[1]}").RootElement));
    }
}
