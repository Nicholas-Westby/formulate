namespace Formulate.Core.Tests.UtilityTests
{
    using Newtonsoft.Json;
    using Newtonsoft.Json.Linq;
    using Utilities.Internal;
    using Xunit;

    /// <summary>
    /// These tests change <see cref="JsonConvert.DefaultSettings"/>, which is process-wide, so they
    /// run on their own rather than alongside other tests.
    /// </summary>
    [CollectionDefinition(nameof(GlobalJsonSettingsCollection), DisableParallelization = true)]
    public sealed class GlobalJsonSettingsCollection
    {
    }

    [Collection(nameof(GlobalJsonSettingsCollection))]
    public class NewtonsoftJsonSerializerTests
    {
        [Fact]
        public void A_type_name_in_the_json_does_not_create_that_type_even_when_global_settings_allow_it()
        {
            var original = JsonConvert.DefaultSettings;
            JsonConvert.DefaultSettings = () => new JsonSerializerSettings { TypeNameHandling = TypeNameHandling.All };

            try
            {
                var json = new JsonUtility(new NewtonsoftJsonSerializer());
                var input = "{\"Value\":{\"$type\":\"" + typeof(Gadget).AssemblyQualifiedName + "\",\"Name\":\"x\"}}";

                var holder = json.Deserialize<Holder>(input);

                Assert.IsType<JObject>(holder.Value);
            }
            finally
            {
                JsonConvert.DefaultSettings = original;
            }
        }

        [Fact]
        public void Global_settings_do_not_change_what_is_written()
        {
            var original = JsonConvert.DefaultSettings;
            JsonConvert.DefaultSettings = () => new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore };

            try
            {
                var json = new JsonUtility(new NewtonsoftJsonSerializer());

                var written = json.Serialize(new Holder());

                Assert.Equal("{\"Value\":null}", written);
            }
            finally
            {
                JsonConvert.DefaultSettings = original;
            }
        }

        public sealed class Holder
        {
            public object Value { get; set; }
        }

        /// <summary>
        /// The type the JSON names. Creating it from untrusted JSON is what TypeNameHandling allows.
        /// </summary>
        public sealed class Gadget
        {
            public string Name { get; set; }
        }
    }
}
