using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Formulate.Extensions.PlainJavaScriptTemplate.Tests;

public sealed class FormJsonTests
{
    [Fact]
    public void Json_escapes_script_breakout_sequences()
    {
        const string label = "</script><!-- & ' \u2028 \u2029 >";
        var harness = new FormJsonHarness();
        harness.AddField("name", label, new PlainJavaScriptFormField("text"));

        var raw = harness.BuildRaw(formName: "</script>");

        Assert.DoesNotContain("</", raw);
        Assert.DoesNotContain("<!--", raw);
        Assert.DoesNotContain("<", raw);
        Assert.DoesNotContain(">", raw);
        Assert.DoesNotContain("&", raw);
        Assert.DoesNotContain("'", raw);
        Assert.DoesNotContain("\u2028", raw);
        Assert.DoesNotContain("\u2029", raw);
        var parsed = JObject.Parse(raw);
        Assert.Equal(label, parsed["data"]!["fields"]![0]!["label"]!.Value<string>());
        Assert.Equal("</script>", parsed["data"]!["name"]!.Value<string>());
    }
}
