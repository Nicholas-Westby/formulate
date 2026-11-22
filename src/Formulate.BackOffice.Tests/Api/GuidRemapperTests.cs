using Formulate.BackOffice.Api.Json;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class GuidRemapperTests
{
    private static readonly Guid Old = Guid.Parse("aaaaaaaa-1111-2222-3333-444444444444");
    private static readonly Guid New = Guid.Parse("bbbbbbbb-5555-6666-7777-888888888888");
    private static readonly Dictionary<Guid, Guid> Map = new() { [Old] = New };

    [Fact]
    public void Replaces_strings_at_any_depth_keeping_the_format_and_case()
    {
        var json = $$"""{"a":"{{Old:D}}","b":["{{Old:N}}",{"c":"{{Old.ToString("D").ToUpperInvariant()}}"}],"d":"{{Old:B}}"}""";

        var result = GuidRemapper.Remap(json, Map);

        Assert.Equal($$"""{"a":"{{New:D}}","b":["{{New:N}}",{"c":"{{New.ToString("D").ToUpperInvariant()}}"}],"d":"{{New:B}}"}""", result);
    }

    [Fact]
    public void Leaves_other_ids_other_values_and_unchanged_text_alone()
    {
        var other = Guid.NewGuid();
        var json = $$"""{"keep":"{{other:D}}","number":1.50,"text":"hello {{Old:D}}","flag":true,"nothing":null,"date":"2020-01-01T00:00:00Z"}""";

        Assert.Equal(json, GuidRemapper.Remap(json, Map));
    }

    [Fact]
    public void Returns_empty_and_invalid_input_unchanged()
    {
        Assert.Null(GuidRemapper.Remap(null, Map));
        Assert.Equal("", GuidRemapper.Remap("", Map));
        Assert.Equal("{not json", GuidRemapper.Remap("{not json", Map));
    }

    [Fact]
    public void Replaces_a_bare_string_value()
    {
        Assert.Equal($"\"{New:D}\"", GuidRemapper.Remap($"\"{Old:D}\"", Map));
    }
}
